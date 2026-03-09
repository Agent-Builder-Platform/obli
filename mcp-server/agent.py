import asyncio
import anthropic
import os
import json
import time
from dotenv import load_dotenv
from fastmcp import Client

load_dotenv()

claude = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
    base_url="https://api.anthropic.com"
)
MCP_URL = "http://127.0.0.1:8000/mcp"


def extract_tool_result(result) -> str:
    """Extract clean text from FastMCP CallToolResult"""
    try:
        if hasattr(result, 'content') and result.content:
            content = result.content[0]
            if hasattr(content, 'text'):
                return content.text
            return str(content)
        if isinstance(result, (dict, list)):
            return json.dumps(result)
        return str(result)
    except Exception as e:
        return f"Error extracting result: {e}"


async def run_agent(user_prompt: str):

    # ── Get tools from MCP server ──────────────────────────────
    async with Client(MCP_URL) as client:
        mcp_tools = await client.list_tools()

    total_input_tokens = 0
    total_output_tokens = 0

    # ── STEP 1: PLANNER (normal mode, cheap) ──────────────────
    print("\n[PLANNER] Generating execution plan...")

    plan_response = claude.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=500,
        system="""You are a task planner for an email agent.
                Given a task, return ONLY a valid JSON plan (no markdown, no explanation):
                {
                "tools_needed": ["tool1", "tool2"],
                "batch_size": 5,
                "search_filters": "gmail search query",
                "read_emails": true,
                "notes": "any special instructions"
                }

                Available tools: search_emails, list_emails, read_email, send_email, resolve_contact
                Do NOT execute anything. Just return the JSON plan.""",
        messages=[{"role": "user", "content": user_prompt}]
    )

    total_input_tokens += plan_response.usage.input_tokens
    total_output_tokens += plan_response.usage.output_tokens

    # Parse plan
    try:
        plan_text = plan_response.content[0].text.strip()
        # Strip markdown code fences if present
        if plan_text.startswith("```"):
            plan_text = plan_text.split("```")[1]
            if plan_text.startswith("json"):
                plan_text = plan_text[4:]
        plan = json.loads(plan_text)
        print(f"[PLAN] {json.dumps(plan, indent=2)}")
    except Exception:
        # If parsing fails just use raw text
        plan = {"notes": plan_response.content[0].text}
        print(f"[PLAN] {plan['notes']}")

    # ── STEP 2: EXECUTOR (PTC mode, powerful) ──────────────────
    print("\n[EXECUTOR] Running PTC execution...")

    tools = [
        {
            "type": "code_execution_20250825",
            "name": "code_execution"
        },
        *[{
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.inputSchema,
            "allowed_callers": ["code_execution_20250825"]
        } for tool in mcp_tools]
    ]

    # Inject plan into prompt so PTC executor knows exactly what to do
    augmented_prompt = f"""Task: {user_prompt}

Execution plan:
{json.dumps(plan, indent=2)}

Instructions:
- Follow the plan exactly
- Use code execution to batch ALL tool calls into loops
- ALWAYS call read_email() on every email you need to analyse
- NEVER summarise based on subject lines or snippets alone
- At the end state exactly how many emails you called read_email() on"""

    messages = [{"role": "user", "content": augmented_prompt}]
    container_id = None

    # Agentic PTC loop
    while True:
        kwargs = {}
        if container_id:
            kwargs["container"] = container_id

        # Rate limit retry
        while True:
            try:
                response = claude.beta.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=4096,
                    betas=["advanced-tool-use-2025-11-20"],
                    tools=tools,
                    messages=messages,
                    **kwargs
                )
                break
            except anthropic.RateLimitError:
                print("\n[Rate limit — waiting 60s...]")
                time.sleep(60)

        total_input_tokens += response.usage.input_tokens
        total_output_tokens += response.usage.output_tokens

        # Save container ID
        if hasattr(response, "container") and response.container:
            container_id = response.container.id
            print(f"\n[Container] {container_id}")

        # Process blocks
        tool_results = []
        for block in response.content:
            print(f"\n[DEBUG] Block type: {block.type}")

            if block.type == "text":
                print(f"\nClaude: {block.text}")

            elif block.type == "server_tool_use":
                print(f"\n[PTC ✅] Claude wrote this code:")
                code = getattr(block, 'input', {}).get('code', '')
                # Print first 500 chars of code
                print(f"  {code[:500]}{'...' if len(code) > 500 else ''}")

            elif block.type == "code_execution_tool_result":
                print(f"\n[PTC RESULT]:")
                content = getattr(block, 'content', '')
                print(f"  {str(content)[:300]}{'...' if len(str(content)) > 300 else ''}")

            elif block.type == "tool_use":
                caller = getattr(block, "caller", None)
                if caller:
                    print(f"\n[PTC TOOL CALL ✅] {block.name}")
                else:
                    print(f"\n[NORMAL TOOL CALL] {block.name}")

                print(f"  Input: {block.input}")

                async with Client(MCP_URL) as client:
                    result = await client.call_tool(block.name, block.input)

                clean_result = extract_tool_result(result)
                print(f"  Result preview: {clean_result[:200]}...")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": clean_result
                })

        # Done
        if response.stop_reason == "end_turn":
            print(f"\n{'='*40}")
            print(f"[TOKEN USAGE - HYBRID]")
            print(f"  Planner:       {plan_response.usage.input_tokens + plan_response.usage.output_tokens:,} tokens")
            print(f"  Executor in:   {total_input_tokens - plan_response.usage.input_tokens:,} tokens")
            print(f"  Executor out:  {total_output_tokens - plan_response.usage.output_tokens:,} tokens")
            print(f"  ─────────────────────────────")
            print(f"  Total:         {total_input_tokens + total_output_tokens:,} tokens")
            print(f"{'='*40}")
            break

        if tool_results:
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            break


async def main():
    print("🤖 Obli Agent (HYBRID mode) — type 'exit' to quit\n")

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == "exit":
            break
        if not user_input:
            continue
        await run_agent(user_input)


if __name__ == "__main__":
    asyncio.run(main())
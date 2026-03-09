import asyncio
import anthropic
import os
import json
from dotenv import load_dotenv
from fastmcp import Client

load_dotenv()

claude = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
    base_url="https://api.anthropic.com"
)
MCP_URL = "http://127.0.0.1:8000/mcp"

def extract_tool_result(result) -> str:
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

    async with Client(MCP_URL) as client:
        mcp_tools = await client.list_tools()

    # Normal tool calling — NO code_execution, NO allowed_callers
    tools = [
        {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.inputSchema,
        } for tool in mcp_tools
    ]

    messages = [{"role": "user", "content": user_prompt}]
    total_input_tokens = 0
    total_output_tokens = 0

    while True:
        response = claude.messages.create(  # ← no .beta
            model="claude-sonnet-4-5-20250929",
            max_tokens=4096,
            tools=tools,
            messages=messages,
        )

        # Track tokens
        total_input_tokens += response.usage.input_tokens
        total_output_tokens += response.usage.output_tokens

        tool_results = []
        for block in response.content:
            print(f"\n[DEBUG] Block type: {block.type}")

            if block.type == "text":
                print(f"\nClaude: {block.text}")

            elif block.type == "tool_use":
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

        if response.stop_reason == "end_turn":
            break

        if tool_results:
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            break

    # Print token summary
    print(f"\n{'='*40}")
    print(f"[TOKEN USAGE - NORMAL]")
    print(f"  Input tokens:  {total_input_tokens:,}")
    print(f"  Output tokens: {total_output_tokens:,}")
    print(f"  Total:         {total_input_tokens + total_output_tokens:,}")
    print(f"{'='*40}")

async def main():
    print("🤖 Obli Agent (NORMAL mode) — type 'exit' to quit\n")

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == "exit":
            break
        if not user_input:
            continue
        await run_agent(user_input)

if __name__ == "__main__":
    asyncio.run(main())
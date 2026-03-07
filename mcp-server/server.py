import sys
from fastmcp import FastMCP

# --- Import MCP modules ---
import gmail_mcp
# To add more in future: import calendar_mcp, notion_mcp, etc.

mcp = FastMCP("Obli MCP Server")

# --- Register tools from each module ---
gmail_mcp.register(mcp)
# To add more in future: calendar_mcp.register(mcp)

if __name__ == "__main__":
    if "--auth" in sys.argv:
        from gmail_auth import get_gmail_service
        print("Authenticating Gmail...")
        get_gmail_service()
        print("✅ Authenticated! token.json saved.")
    else:
        mcp.run(transport="streamable-http", host="127.0.0.1", port=8000)


import re
import base64
from collections import Counter
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from gmail_auth import get_gmail_service


def register(mcp):
    """Register all Gmail tools onto the given FastMCP instance."""

    @mcp.tool()
    def resolve_contact(name: str) -> dict:
        """Look up a contact's email address by name from your Gmail history.

        Searches your sent and received messages to find the most likely
        email address for a given name.

        Args:
            name: The person's name to look up (e.g. "John", "Sarah Smith").

        Returns:
            Dict with 'name' and 'email'. Returns an error dict if no match is found.
        """
        service = get_gmail_service()
        email_counter = Counter()
        name_lower = name.lower().strip()

        for q in [f"from:{name}", f"to:{name}"]:
            try:
                results = service.users().messages().list(
                    userId="me", q=q, maxResults=20
                ).execute()
            except Exception:
                continue

            for m in results.get("messages", []):
                try:
                    detail = service.users().messages().get(
                        userId="me",
                        id=m["id"],
                        format="metadata",
                        metadataHeaders=["From", "To"]
                    ).execute()
                except Exception:
                    continue

                for header in detail.get("payload", {}).get("headers", []):
                    if header["name"] in ("From", "To"):
                        addresses = re.findall(r'[\w.+-]+@[\w.-]+', header["value"])
                        for addr in addresses:
                            email_counter[addr.lower()] += 1

        matching = {addr: count for addr, count in email_counter.items()
                    if name_lower in addr.split("@")[0]}

        if not matching:
            return {
                "status": "error",
                "message": f"No email found for '{name}'. Try the full email address instead.",
            }

        best = max(matching, key=matching.get)
        # ← removed confidence field, noise for Claude
        return {"name": name, "email": best}

    @mcp.tool()
    def send_email(to: str, subject: str, body: str, cc: str = "") -> dict:
        """Send an email via Gmail.

        Args:
            to: Recipient email address. Use "me" to send to yourself.
                Call resolve_contact first if you only have a name.
            subject: The email subject line.
            body: The full email body text. Always sign off with the user's name.
            cc: CC addresses, comma-separated. Leave empty if none.

        Returns:
            Dict with status, recipient, subject, and message_id.
        """
        service = get_gmail_service()

        if to.lower() in ("me", "myself", ""):
            profile = service.users().getProfile(userId="me").execute()
            to = profile["emailAddress"]

        msg = MIMEMultipart()
        msg["To"] = to
        msg["Subject"] = subject
        if cc:
            msg["Cc"] = cc
        msg.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        result = service.users().messages().send(userId="me", body={"raw": raw}).execute()

        # ← removed body_preview, saves tokens
        return {
            "status": "sent",
            "message_id": result["id"],
            "to": to,
            "subject": subject,
        }

    @mcp.tool()
    def list_emails(max_results: int = 10, page_token: str = "") -> dict:
        """List the most recent emails in your Gmail inbox.

        Use this to browse your inbox without any specific search criteria.
        Each result includes the message id which can be passed to read_email
        to fetch the full content.

        Args:
            max_results: Number of emails to return (default 10, max 500).
            page_token: Pagination token from a previous result to get the next page.

        Returns:
            Dict with 'emails' list (id, sub, from, date, preview) and
            optional 'next_page_token'.
        """
        service = get_gmail_service()
        params = {"userId": "me", "labelIds": ["INBOX"], "maxResults": max_results}
        if page_token:
            params["pageToken"] = page_token

        results = service.users().messages().list(**params).execute()
        messages = results.get("messages", [])

        if not messages:
            return {"emails": []}

        emails = []
        for msg in messages:
            detail = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["Subject", "From", "Date"]
            ).execute()
            headers = {h["name"]: h["value"] for h in detail["payload"]["headers"]}
            emails.append({
                "id": msg["id"],
                "sub": headers.get("Subject", "")[:80],       # ← shorter key + truncated
                "from": headers.get("From", "")[:50],          # ← truncated
                "date": headers.get("Date", "")[:16],          # ← just date/time
                "preview": detail.get("snippet", "")[:100],    # ← shorter key + truncated
            })

        response = {"emails": emails}
        if results.get("nextPageToken"):
            response["next_page_token"] = results["nextPageToken"]
        return response

    @mcp.tool()
    def search_emails(query: str, max_results: int = 10, page_token: str = "") -> dict:
        """Search Gmail using a query string.

        Use Gmail search operators to filter results. Each result includes
        the message id which can be passed to read_email for the full content.

        Args:
            query: Gmail search query using operators such as:
                   from:, to:, subject:, is:unread, has:attachment,
                   after:YYYY/MM/DD, before:YYYY/MM/DD, label:, in:sent, etc.
                   Examples: "from:john is:unread", "subject:invoice has:attachment"
            max_results: Number of emails to return (default 10, max 500).
            page_token: Pagination token from a previous result to get the next page.

        Returns:
            Dict with 'emails' list (id, sub, from, date, preview) and
            optional 'next_page_token'.
        """
        service = get_gmail_service()
        params = {"userId": "me", "q": query, "maxResults": max_results}
        if page_token:
            params["pageToken"] = page_token

        results = service.users().messages().list(**params).execute()
        messages = results.get("messages", [])

        if not messages:
            return {"emails": [], "query": query}

        emails = []
        for msg in messages:
            detail = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["Subject", "From", "Date"]
            ).execute()
            headers = {h["name"]: h["value"] for h in detail["payload"]["headers"]}
            emails.append({
                "id": msg["id"],
                "sub": headers.get("Subject", "")[:80],       # ← shorter key + truncated
                "from": headers.get("From", "")[:50],          # ← truncated
                "date": headers.get("Date", "")[:16],          # ← just date/time
                "preview": detail.get("snippet", "")[:100],    # ← shorter key + truncated
            })

        response = {"emails": emails, "query": query}
        if results.get("nextPageToken"):
            response["next_page_token"] = results["nextPageToken"]
        return response

    @mcp.tool()
    def read_email(message_id: str, max_chars: int = 500) -> dict:
        """Read the full content of a specific Gmail message by its id.

        Use list_emails or search_emails first to find message ids, then
        call this tool to read the complete body of a specific email.

        Args:
            message_id: The Gmail message id (e.g. "19525f8e8c0c8baa").
            max_chars: Max characters of body to return (default 500, max 5000).

        Returns:
            Dict with id, subject, from, to, date, and body.
        """
        service = get_gmail_service()
        try:
            detail = service.users().messages().get(
                userId="me", id=message_id, format="full"
            ).execute()
        except Exception as e:
            return {"status": "error", "message": f"Could not fetch message {message_id}: {e}"}

        headers = {h["name"]: h["value"] for h in detail["payload"].get("headers", [])}

        body = ""
        payload = detail["payload"]
        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                    body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                    break
        elif payload.get("body", {}).get("data"):
            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

        # ← cap max_chars at 5000 for safety
        max_chars = min(max_chars, 5000)

        # ← removed snippet (redundant with body), truncated body
        return {
            "id": message_id,
            "sub": headers.get("Subject", "")[:80],
            "from": headers.get("From", "")[:50],
            "to": headers.get("To", "")[:50],
            "date": headers.get("Date", "")[:16],
            "body": body[:max_chars] + ("..." if len(body) > max_chars else ""),
        }
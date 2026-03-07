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
            Dict with 'name', 'email', and 'confidence' (number of matching
            messages found).  Returns an error dict if no match is found.
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
                "message": f"Could not find an email address for '{name}'. "
                           f"Try providing the full email address instead.",
            }

        best = max(matching, key=matching.get)
        return {"name": name, "email": best, "confidence": matching[best]}

    @mcp.tool()
    def send_email(to: str, subject: str, body: str, cc: str = "") -> dict:
        """Send an email via Gmail.

        Args:
            to: Recipient email address. Use "me" to send to yourself.
                Call resolve_contact first if you only have a name.
            subject: The email subject line.
            body: The full email body text, and remember at the end do not just leave it blank make sure you leave the user's name to finish the email.
            cc: CC addresses, comma-separated. Leave empty if none.

        Returns:
            Dict with status, recipient, subject, body preview, and message_id.
        """

        service = get_gmail_service()

        # Resolve "me" / "myself" to own email
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

        return {
            "status": "sent",
            "message_id": result["id"],
            "to": to,
            "subject": subject,
            "body_preview": body[:200],
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
            Dict with 'emails' list (id, subject, from, date, snippet) and
            optional 'next_page_token'.
        """
        service = get_gmail_service()
        params = {"userId": "me", "labelIds": ["INBOX"], "maxResults": max_results}
        if page_token:
            params["pageToken"] = page_token

        results = service.users().messages().list(**params).execute()
        messages = results.get("messages", [])

        if not messages:
            return {"emails": [], "message": "Inbox is empty."}

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
                "subject": headers.get("Subject", "(no subject)"),
                "from": headers.get("From", "unknown"),
                "date": headers.get("Date", "unknown"),
                "snippet": detail.get("snippet", ""),
            })

        response = {"emails": emails}
        if results.get("nextPageToken"):
            response["next_page_token"] = results["nextPageToken"]
            response["hint"] = "More results available. Call list_emails again with this next_page_token."
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
            Dict with 'emails' list (id, subject, from, date, snippet), the
            'query' used, and optional 'next_page_token'.
        """
        service = get_gmail_service()
        params = {"userId": "me", "q": query, "maxResults": max_results}
        if page_token:
            params["pageToken"] = page_token

        results = service.users().messages().list(**params).execute()
        messages = results.get("messages", [])

        if not messages:
            return {"emails": [], "query": query, "message": f'No emails found for query: "{query}"'}

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
                "subject": headers.get("Subject", "(no subject)"),
                "from": headers.get("From", "unknown"),
                "date": headers.get("Date", "unknown"),
                "snippet": detail.get("snippet", ""),
            })

        response = {"emails": emails, "query": query}
        if results.get("nextPageToken"):
            response["next_page_token"] = results["nextPageToken"]
            response["hint"] = "More results available. Call search_emails again with this next_page_token."
        return response

    @mcp.tool()
    def read_email(message_id: str) -> dict:
        """Read the full content of a specific Gmail message by its id.

        Use list_emails or search_emails first to find message ids, then
        call this tool to read the complete body of a specific email.

        Args:
            message_id: The Gmail message id (e.g. "19525f8e8c0c8baa").

        Returns:
            Dict with id, subject, from, to, date, body (full plain-text),
            and snippet.
        """
        service = get_gmail_service()
        try:
            detail = service.users().messages().get(
                userId="me", id=message_id, format="full"
            ).execute()
        except Exception as e:
            return {"status": "error", "message": f"Could not fetch message {message_id}: {e}"}

        headers = {h["name"]: h["value"] for h in detail["payload"].get("headers", [])}

        # Extract plain-text body (handles simple and multipart)
        body = ""
        payload = detail["payload"]
        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                    body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                    break
        elif payload.get("body", {}).get("data"):
            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

        return {
            "id": message_id,
            "subject": headers.get("Subject", "(no subject)"),
            "from": headers.get("From", "unknown"),
            "to": headers.get("To", "unknown"),
            "date": headers.get("Date", "unknown"),
            "body": body,
            "snippet": detail.get("snippet", ""),
        }

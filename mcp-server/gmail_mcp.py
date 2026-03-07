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
    def get_emails(
        query: str = "",
        max_results: int = 10,
        message_id: str = "",
        page_token: str = "",
    ) -> dict:
        """Search, list, or read Gmail messages.

        To list/search: provide a query and/or max_results.
        To read a specific message: provide its message_id.

        Args:
            query: Gmail search query using Gmail operators
                   (from:, to:, subject:, is:unread, has:attachment,
                   after:, before:, label:, etc.).
                   Leave empty to show the inbox.
            max_results: Number of emails to return (default 10).
            message_id: A Gmail message id to read in full.
                        When provided, query and max_results are ignored.
            page_token: Pagination token from a previous result.

        Returns:
            For listing: dict with 'emails' list, 'query', and optional 'next_page_token'.
            For reading: dict with full message details including 'body'.
        """
        service = get_gmail_service()

        # ── Read a single message by id ──────────────────────────────
        if message_id:
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

        # ── List / search emails ─────────────────────────────────────
        params = {"userId": "me", "maxResults": max_results}
        if query:
            params["q"] = query
        else:
            params["labelIds"] = ["INBOX"]
        if page_token:
            params["pageToken"] = page_token

        results = service.users().messages().list(**params).execute()
        messages = results.get("messages", [])

        if not messages:
            return {"emails": [], "query": query, "message": "No emails found for this query."}

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
                "snippet": detail.get("snippet", "")
            })

        response = {"emails": emails, "query": query, "max_results": max_results}
        if results.get("nextPageToken"):
            response["next_page_token"] = results["nextPageToken"]
            response["hint"] = "More results available. Call get_emails again with this next_page_token to get the next page."
        return response

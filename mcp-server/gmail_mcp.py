import os
import json
import re
import base64
from collections import Counter
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from openai import OpenAI
from gmail_auth import get_gmail_service

load_dotenv()
_openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _parse_email_prompt(prompt: str) -> dict:
    """Use OpenAI to extract structured email fields from a natural language prompt."""
    response = _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You extract structured email data from a user's natural language request. "
                    "Return ONLY valid JSON with these fields:\n"
                    '  "to": recipient email address (or empty string if not specified)\n'
                    '  "subject": a relevant subject line you generate from context\n'
                    '  "body": the full email body text, written naturally\n'
                    '  "cc": CC addresses comma-separated (or empty string)\n'
                    "If the user says 'myself' or 'me', set to to 'me'.\n"
                    "Do not include any markdown, code fences, or explanation — just the JSON object."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return json.loads(response.choices[0].message.content)


def _parse_search_prompt(prompt: str) -> dict:
    """Use OpenAI to convert a natural language search request into Gmail query + count."""
    response = _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You convert a natural language email search request into Gmail search parameters. "
                    "Return ONLY valid JSON with these fields:\n"
                    '  "query": a Gmail search query string using Gmail operators '
                    "(from:, to:, subject:, is:unread, has:attachment, after:, before:, label:, etc). "
                    "Use empty string for 'show my inbox' or 'list my emails'.\n"
                    '  "max_results": integer number of emails to return (default 10 if not specified)\n'
                    "Examples:\n"
                    '  "show me 20 emails from john" → {"query": "from:john", "max_results": 20}\n'
                    '  "find unread emails about invoices" → {"query": "is:unread subject:invoices", "max_results": 10}\n'
                    '  "list my last 5 emails" → {"query": "", "max_results": 5}\n'
                    "Do not include any markdown, code fences, or explanation — just the JSON object."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return json.loads(response.choices[0].message.content)


def _resolve_email_from_name(name: str, service) -> tuple[str, int]:
    """Resolve a name to an email address by searching Gmail history.

    Searches from:{name} and to:{name}, extracts all email addresses from
    From/To headers, counts occurrences of addresses containing the name,
    and returns a (email, count) tuple for the most common match.
    """
    email_counter = Counter()
    name_lower = name.lower().strip()

    for query in [f"from:{name}", f"to:{name}"]:
        try:
            results = service.users().messages().list(
                userId="me", q=query, maxResults=20
            ).execute()
        except Exception:
            continue

        for msg in results.get("messages", []):
            try:
                detail = service.users().messages().get(
                    userId="me",
                    id=msg["id"],
                    format="metadata",
                    metadataHeaders=["From", "To"]
                ).execute()
            except Exception:
                continue

            for header in detail.get("payload", {}).get("headers", []):
                if header["name"] in ("From", "To"):
                    # Extract all email addresses from the header value
                    addresses = re.findall(r'[\w.+-]+@[\w.-]+', header["value"])
                    for addr in addresses:
                        email_counter[addr.lower()] += 1

    # Filter to addresses that contain the name string
    matching = {addr: count for addr, count in email_counter.items()
                if name_lower in addr.split("@")[0]}

    if not matching:
        raise ValueError(
            f"Could not find an email address for '{name}'. "
            f"Try providing the full email address instead."
        )

    best = max(matching, key=matching.get)
    return best, matching[best]


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
        try:
            email, confidence = _resolve_email_from_name(name, service)
            return {"name": name, "email": email, "confidence": confidence}
        except ValueError as e:
            return {"status": "error", "message": str(e)}

    @mcp.tool()
    def send_email(prompt: str) -> dict:
        """Send an email via Gmail from a plain English prompt.

        Just describe what you want to send in natural language. Examples:
        - "send a friendly hello to john@example.com"
        - "email myself a reminder to buy groceries"
        - "write a professional follow-up to sarah@company.com about the Q3 report"

        The AI will figure out the recipient, subject, and body automatically.

        Args:
            prompt: A natural language description of the email to send.

        Returns:
            Dict with status, parsed fields, and message_id.
        """
        parsed = _parse_email_prompt(prompt)

        to = parsed.get("to", "")
        subject = parsed.get("subject", "")
        body = parsed.get("body", "")
        cc = parsed.get("cc", "")

        service = get_gmail_service()

        # Resolve "me" / "myself" to own email
        if to.lower() in ("me", "myself", ""):
            profile = service.users().getProfile(userId="me").execute()
            to = profile["emailAddress"]
        # Resolve name → email if no @ present
        elif "@" not in to:
            try:
                to, _confidence = _resolve_email_from_name(to, service)
            except ValueError as e:
                return {"status": "error", "message": str(e)}

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
    def search_emails(prompt: str, page_token: str = "") -> dict:
        """Search Gmail using a plain English prompt.

        Just describe what emails you're looking for. Examples:
        - "show me my last 20 emails"
        - "find emails from john about the project"
        - "get 5 unread emails"
        - "emails with attachments from last week"

        The AI will convert your request into the right Gmail search query and count.

        Args:
            prompt: A natural language description of what emails to find.
            page_token: Pagination token from a previous result to get the next page.

        Returns:
            Dict with 'emails' list, the parsed 'query', and optional 'next_page_token'.
        """
        parsed = _parse_search_prompt(prompt)
        query = parsed.get("query", "")
        max_results = parsed.get("max_results", 10)

        service = get_gmail_service()
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
            return {"emails": [], "query": query, "message": f'No emails found for: "{prompt}"'}

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
            response["hint"] = "More results available. Call search_emails again with this next_page_token to get the next page."
        return response

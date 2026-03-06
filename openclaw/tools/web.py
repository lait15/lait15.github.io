import requests
from bs4 import BeautifulSoup


def web_fetch(url: str, extract_text: bool = True) -> str:
    """Fetch a web page and return its content."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; MiniOpenClaw/1.0)"
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        if not extract_text:
            return response.text[:5000]

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        lines = [line for line in text.splitlines() if line.strip()]
        return "\n".join(lines)[:4000]

    except requests.RequestException as e:
        return f"Error fetching {url}: {e}"

from .web import web_fetch
from .system import read_file, write_file, run_command


TOOLS = [
    {
        "name": "web_fetch",
        "description": "Fetch a web page and extract its text content. Use this to get information from URLs.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to fetch",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file from the workspace directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace directory",
                },
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file in the workspace directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace directory",
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file",
                },
            },
            "required": ["file_path", "content"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a whitelisted shell command in the workspace directory and return its output.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to run",
                },
            },
            "required": ["command"],
        },
    },
]

_TOOL_FUNCTIONS = {
    "web_fetch": lambda args: web_fetch(args["url"]),
    "read_file": lambda args: read_file(args["file_path"]),
    "write_file": lambda args: write_file(args["file_path"], args["content"]),
    "run_command": lambda args: run_command(args["command"]),
}


def execute_tool(name: str, arguments: dict) -> str:
    if name not in _TOOL_FUNCTIONS:
        return f"Unknown tool: {name}"
    try:
        return _TOOL_FUNCTIONS[name](arguments)
    except Exception as e:
        return f"Tool error ({name}): {e}"

import os
import subprocess
from pathlib import Path


def _get_workspace() -> Path:
    workspace = os.environ.get("WORKSPACE_DIR", "./workspace")
    path = Path(workspace).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_path(file_path: str) -> Path:
    workspace = _get_workspace()
    target = (workspace / file_path).resolve()
    if not str(target).startswith(str(workspace)):
        raise PermissionError(f"Access denied: {file_path} is outside workspace")
    return target


def read_file(file_path: str) -> str:
    """Read a file from the workspace directory."""
    try:
        path = _safe_path(file_path)
        if not path.exists():
            return f"File not found: {file_path}"
        return path.read_text(encoding="utf-8")
    except PermissionError as e:
        return str(e)
    except Exception as e:
        return f"Error reading {file_path}: {e}"


def write_file(file_path: str, content: str) -> str:
    """Write content to a file in the workspace directory."""
    try:
        path = _safe_path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return f"Successfully wrote {len(content)} characters to {file_path}"
    except PermissionError as e:
        return str(e)
    except Exception as e:
        return f"Error writing {file_path}: {e}"


def run_command(command: str) -> str:
    """Run a whitelisted shell command and return output."""
    allowed = os.environ.get("ALLOWED_COMMANDS", "ls,pwd,echo,date,cat,curl").split(",")
    allowed = [c.strip() for c in allowed]

    cmd_name = command.strip().split()[0] if command.strip() else ""
    if cmd_name not in allowed:
        return f"Command '{cmd_name}' is not allowed. Allowed: {', '.join(allowed)}"

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(_get_workspace()),
        )
        output = result.stdout + result.stderr
        return output[:3000] if output else "(no output)"
    except subprocess.TimeoutExpired:
        return "Command timed out (30s limit)"
    except Exception as e:
        return f"Error running command: {e}"

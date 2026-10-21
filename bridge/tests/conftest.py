import sys
from pathlib import Path

# The Gree simulator lives in the repository's simulator/ folder; tests drive the bridge against it.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "simulator"))

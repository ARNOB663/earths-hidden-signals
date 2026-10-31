import sys
from pathlib import Path

# Tests import pipeline modules directly, as the top-level tests do; make that work from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

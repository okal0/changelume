import ast
from pathlib import Path
text=Path('src/main.py').read_text()
ast.parse(text)
assert 'UnsupportedGrantTypError' not in text
assert 'UnsupportedGrantTypeError' in text

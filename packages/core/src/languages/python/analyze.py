import ast, json, sys
text=sys.stdin.buffer.read().decode("utf8")
tree=ast.parse(text)
roots={n.asname or "stripe" for n in tree.body if isinstance(n,ast.Import) for n in n.names if n.name=="stripe"}
mapping={"UnsupportedGrantTypError":"UnsupportedGrantTypeError","UnsupportedResponseTypError":"UnsupportedResponseTypeError"}
# Scope changes and module mutation require human review.
unsafe=any(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef,ast.Lambda)) or isinstance(n,ast.Name) and n.id in roots and isinstance(n.ctx,ast.Store) or isinstance(n,ast.Attribute) and isinstance(n.ctx,ast.Store) for n in ast.walk(tree))
parents={child:node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
for node in ast.walk(tree):
 if isinstance(node,ast.Name) and node.id in roots:
  parent=parents.get(node); grand=parents.get(parent)
  if not (isinstance(parent,ast.Attribute) and parent.attr=="oauth_error" and isinstance(grand,ast.Attribute) and grand.attr in mapping):unsafe=True
 if isinstance(node,(ast.Import,ast.ImportFrom)):
  for alias in node.names:
   if (alias.asname or alias.name) in roots and not (isinstance(node,ast.Import) and alias.name=="stripe"):unsafe=True
lines=text.splitlines(keepends=True); offsets=[0]
for line in lines: offsets.append(offsets[-1]+len(line.encode("utf8")))
edits=[]; usages=[]
for n in ast.walk(tree):
 if isinstance(n,ast.Attribute) and n.attr in mapping and isinstance(n.value,ast.Attribute) and n.value.attr=="oauth_error" and isinstance(n.value.value,ast.Name) and n.value.value.id in roots:
  end=offsets[n.end_lineno-1]+n.end_col_offset
  usages.append({"line":n.lineno,"symbol":n.attr,"kind":"unsupported" if unsafe else "field","changeId":"stripe-python-5-oauth-exceptions","editPlanned":not unsafe,"replacement":mapping[n.attr]})
  if not unsafe: edits.append((end-len(n.attr),end,mapping[n.attr]))
data=text.encode("utf8")
for start,end,value in sorted(edits,reverse=True):data=data[:start]+value.encode()+data[end:]
print(json.dumps({"content":data.decode(),"usages":usages,"unsafe":unsafe}))

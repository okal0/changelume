export function redactDiagnostics(value:string):string {
  let text=value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/(?:sk|rk)_(?:live|test)_[\w-]+|sk-[\w-]{12,}|gh[pousr]_[\w]+/g,'[REDACTED]').replace(/((?:authorization|api[_-]?key|password|secret|token)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi,'$1[REDACTED]');
  for(const [name,secret] of Object.entries(process.env)) if(secret&&secret.length>=4&&/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)) text=text.split(secret).join('[REDACTED]');
  return text.slice(0,16384);
}

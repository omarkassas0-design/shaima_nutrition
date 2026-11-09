const environmentsByRequest = new WeakMap();

export function bindEnvironment(request, env) {
  environmentsByRequest.set(request, env);
}

export function environmentFor(request) {
  const env = environmentsByRequest.get(request);
  if (!env) throw new Error('Worker request environment is unavailable.');
  return env;
}

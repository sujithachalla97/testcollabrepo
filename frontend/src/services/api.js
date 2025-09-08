export const api = async (path, { method = "GET", body, token, headers = {} } = {}) => {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers }
  };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`http://localhost:5000${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || "API error");
  return data;
};

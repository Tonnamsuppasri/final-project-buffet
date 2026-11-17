const API_URL = import.meta.env.VITE_API_URL;

export const fetchUsers = async () => {
  const response = await fetch(`${API_URL}/api/staff`);
  return response.json();
};

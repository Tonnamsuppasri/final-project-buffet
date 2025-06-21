// frontend/src/api.js
export const fetchUsers = async () => {
  const response = await fetch('http://localhost:3001/api/users');
  const data = await response.json();
  return data;
};

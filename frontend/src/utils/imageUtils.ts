const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const getImageUrl = (
  image: string | null | undefined,
  fallback: string = ''
): string => {
  if (!image) return fallback;
  if (
    image.startsWith('http://') ||
    image.startsWith('https://') ||
    image.startsWith('data:image/')
  ) {
    return image;
  }
  if (image.startsWith('/uploads/')) {
    return `${apiUrl}${image}`;
  }
  return `data:image/png;base64,${image}`;
};

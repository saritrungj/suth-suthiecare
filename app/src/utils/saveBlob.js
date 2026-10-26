// Saves a downloaded file (axios blob response) under the server's file name.
export function saveBlobResponse(response, fallbackName = "document") {
  const header = response.headers?.["content-disposition"] || "";
  const match = header.match(/filename\*=UTF-8''([^;]+)/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Reads a File as base64 (without the data: prefix) for a JSON upload.
export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

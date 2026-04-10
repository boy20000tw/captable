import { put, del } from "@vercel/blob";

export async function storagePut(
  pathname: string,
  data: Buffer | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const blob = await put(pathname, data, {
    access: "public",
    contentType,
  });
  return { key: pathname, url: blob.url };
}

export async function storageDelete(url: string): Promise<void> {
  await del(url);
}

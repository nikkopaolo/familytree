import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "./client";

export const uploadPersonPhoto = async (clanId: string, personId: string, file: File) => {
  const storage = getFirebaseStorage();
  if (!storage) return { error: "Firebase Storage is not configured.", url: "" };

  const ext = file.name.split(".").pop() || "jpg";
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
  const path = `person-photos/${clanId}/${personId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  try {
    await uploadBytes(storageRef, file, { contentType: file.type || `image/${ext}` });
    const url = await getDownloadURL(storageRef);
    return { error: "", url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed.", url: "" };
  }
};

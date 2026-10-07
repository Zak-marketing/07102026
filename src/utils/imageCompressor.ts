/** Decode the photo before saving it; reject unreadable files instead of saving a blank preview. */
export async function compressImage(source: File | string, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> {
  const temporaryUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve(image) : reject(new Error('Photo illisible. Choisissez une autre image.'));
      image.onerror = () => reject(new Error('Photo illisible. Choisissez une image JPEG, PNG ou WebP.'));
      image.src = temporaryUrl || source as string;
    });
    const ratio = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('La préparation de la photo est indisponible sur cet appareil.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL('image/jpeg', quality);
    if (!encoded.startsWith('data:image/jpeg;base64,') || encoded.length < 80)
      throw new Error('La photo est vide. Veuillez reprendre la photo.');
    return encoded;
  } finally {
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
  }
}

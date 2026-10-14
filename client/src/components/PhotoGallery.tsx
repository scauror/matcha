import { useEffect, useRef, useState } from "react";
import { api, type Photo, type User } from "../api/client";

type FilterId = "none" | "grayscale" | "sepia" | "contrast";

const FILTERS: { id: FilterId; label: string; css: string }[] = [
  { id: "none", label: "Aucun", css: "none" },
  { id: "grayscale", label: "N&B", css: "grayscale(1)" },
  { id: "sepia", label: "Sépia", css: "sepia(0.85)" },
  { id: "contrast", label: "Contraste", css: "contrast(1.35) saturate(1.1)" },
];

type Props = {
  photos: Photo[];
  onUser: (user: User) => void;
  onError: (message: string) => void;
};

export function PhotoGallery({ photos, onUser, onError }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [editor, setEditor] = useState<{ file: File; url: string } | null>(null);

  async function uploadBlob(blob: Blob, name: string) {
    const body = new FormData();
    body.append("photo", blob, name);
    await api("/api/profile/me/photos", { method: "POST", body });
    const data = await api<{ user: User }>("/api/profile/me");
    onUser(data.user);
  }

  function openEditor(file: File) {
    if (photos.length >= 5) {
      onError("Maximum 5 photos.");
      return;
    }
    if (editor?.url) URL.revokeObjectURL(editor.url);
    setEditor({ file, url: URL.createObjectURL(file) });
  }

  async function setProfilePhoto(photoId: string) {
    const data = await api<{ user: User }>(`/api/profile/me/photos/${photoId}/profile`, {
      method: "POST",
    });
    onUser(data.user);
  }

  async function removePhoto(photoId: string) {
    const data = await api<{ user: User }>(`/api/profile/me/photos/${photoId}`, {
      method: "DELETE",
    });
    onUser(data.user);
  }

  async function persistOrder(ids: string[]) {
    const data = await api<{ user: User }>("/api/profile/me/photos/order", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
    onUser(data.user);
  }

  function onDropReorder(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const ids = photos.map((p) => p.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggingId);
    void persistOrder(ids).catch(() => onError("Réordonnancement impossible."));
  }

  return (
    <div>
      <div className="photo-grid">
        {photos.map((photo) => (
          <figure
            key={photo.id}
            className={photo.is_profile ? "photo-card is-profile" : "photo-card"}
            draggable
            onDragStart={() => setDraggingId(photo.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropReorder(photo.id)}
          >
            <img src={photo.path} alt="" />
            <figcaption>
              {photo.is_profile ? (
                <span>Photo de profil</span>
              ) : (
                <button type="button" className="linkish" onClick={() => void setProfilePhoto(photo.id)}>
                  Définir comme profil
                </button>
              )}
              <button type="button" className="linkish danger" onClick={() => void removePhoto(photo.id)}>
                Supprimer
              </button>
              <span className="muted">Glisser pour réordonner</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {photos.length < 5 ? (
        <div
          className={dropActive ? "dropzone is-active" : "dropzone"}
          onDragOver={(e) => {
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropActive(false);
            const file = e.dataTransfer.files[0];
            if (file) openEditor(file);
          }}
        >
          <p>Glisse une image ici, ou</p>
          <label className="btn btn-ghost file-btn">
            Choisir un fichier
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) openEditor(file);
              }}
            />
          </label>
        </div>
      ) : null}

      {editor ? (
        <PhotoEditor
          src={editor.url}
          onCancel={() => {
            URL.revokeObjectURL(editor.url);
            setEditor(null);
          }}
          onApply={async (blob) => {
            try {
              await uploadBlob(blob, "photo.jpg");
              URL.revokeObjectURL(editor.url);
              setEditor(null);
            } catch {
              onError("Upload impossible.");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function PhotoEditor({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (blob: Blob) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState<FilterId>("none");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const size = 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.filter = FILTERS.find((f) => f.id === filter)?.css ?? "none";
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 2);
    const scale = Math.max(size / img.width, size / img.height) * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.filter = "none";
  }, [ready, rotation, zoom, filter]);

  async function apply() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPending(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.9);
      });
      await onApply(blob);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="photo-editor panel">
      <h3>Éditer la photo</h3>
      <canvas ref={canvasRef} className="photo-editor-canvas" />
      <div className="form-row">
        <button type="button" className="btn btn-ghost" onClick={() => setRotation((r) => (r + 1) % 4)}>
          Rotation 90°
        </button>
        <label className="field-inline">
          Zoom
          <input
            type="range"
            min="1"
            max="2.4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.id}
            className={filter === f.id ? "chip static" : "chip"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="form-row">
        <button type="button" className="btn" onClick={() => void apply()} disabled={pending}>
          {pending ? "Envoi…" : "Appliquer et envoyer"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

import { TripMetadataForm } from "./trip-metadata-form";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">פרטי הטיול</h1>
        <p className="text-sm text-muted-foreground mt-0.5">מידע בסיסי — ישמש בכל הנספחים</p>
      </div>
      <TripMetadataForm />
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { Profile } from "@/lib/types";

export function ProfileSelect() {
  const navigate = useNavigate();
  const setProfile = useAppStore((s) => s.setProfile);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: api.listProfiles,
  });

  function choose(profile: Profile) {
    setProfile(profile);
    navigate("/home");
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-10 bg-bg">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="font-display text-3xl font-semibold text-ink">Who's practicing?</div>
        <div className="text-sm text-ink-muted">Select a profile to continue.</div>
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        {isLoading && <div className="text-sm text-ink-faint">Loading profiles...</div>}

        {profiles?.map((profile, i) => (
          <button
            key={profile.id}
            autoFocus={i === 0}
            onClick={() => choose(profile)}
            className="flex w-56 flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-7 text-center hover:bg-surface-hover"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-semibold text-bg"
              style={{ background: profile.color }}
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-base font-semibold text-ink">{profile.name}</div>
          </button>
        ))}

        <button
          onClick={() => navigate("/profiles/new")}
          className="flex w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong p-7 text-center hover:bg-surface-hover"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border-strong text-2xl text-ink-faint">
            +
          </div>
          <div className="text-sm font-semibold text-ink-muted">New profile</div>
        </button>
      </div>

      <div className="text-xs text-border-strong">v0.1 &middot; practice log stored locally</div>
    </div>
  );
}

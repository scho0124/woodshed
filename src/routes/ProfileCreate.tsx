import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useHotkeys } from "@/hooks/useHotkeys";

const COLORS = ["#E3A458", "#E2725B", "#4FA8A0", "#C9B48A", "#9C7BA8"];

export function ProfileCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setProfile = useAppStore((s) => s.setProfile);

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  const createProfile = useMutation({
    mutationFn: () => api.createProfile(name.trim(), color),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setProfile(profile);
      navigate("/home");
    },
  });

  const canCreate = !!name.trim() && !createProfile.isPending;

  useHotkeys({
    Enter: () => canCreate && createProfile.mutate(),
    Escape: () => navigate("/profiles"),
  });

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg">
      <div className="flex w-[520px] flex-col gap-6 rounded-2xl border border-border bg-surface p-10">
        <div>
          <div className="font-display text-2xl font-semibold text-ink">Create your profile</div>
          <div className="mt-1 text-xs text-ink-faint">
            This just personalizes the app. You can change it anytime.
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="e.g. Ryan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Color</Label>
          <div className="flex gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-8 w-8 rounded-full border-2",
                  color === c ? "border-ink" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/profiles")}>
            Back
          </Button>
          <Button
            className="flex-[2]"
            disabled={!canCreate}
            onClick={() => createProfile.mutate()}
          >
            Create Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

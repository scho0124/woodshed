import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/useHotkeys";

export function Splash() {
  const navigate = useNavigate();

  useHotkeys({ Enter: () => navigate("/profiles") });

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center gap-5 bg-bg">
      <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-rhythm font-display text-3xl font-bold text-bg">
        W
      </div>
      <div className="font-display text-5xl font-semibold tracking-tight text-ink">
        Woodshed
      </div>
      <div className="text-base text-ink-muted">Deliberate practice for guitar.</div>
      <div className="mt-3 h-px w-32 bg-border-strong" />
      <div className="mt-1 text-xs uppercase tracking-[2px] text-ink-faint">Tuning up</div>
      <Button size="lg" className="mt-8" onClick={() => navigate("/profiles")}>
        Enter Woodshed
      </Button>
      <div className="absolute bottom-7 text-xs text-border-strong">
        v0.1 &middot; practice log stored locally
      </div>
    </div>
  );
}

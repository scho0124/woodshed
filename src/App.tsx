import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Splash } from "@/routes/Splash";
import { ProfileSelect } from "@/routes/ProfileSelect";
import { ProfileCreate } from "@/routes/ProfileCreate";
import { Home } from "@/routes/Home";
import { SkillList } from "@/routes/SkillList";
import { SessionSetup } from "@/routes/SessionSetup";
import { PracticeSession } from "@/routes/PracticeSession";
import { SessionComplete } from "@/routes/SessionComplete";
import { Progress } from "@/routes/Progress";
import { TabLibrary } from "@/routes/TabLibrary";
import { TabView } from "@/routes/TabView";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/profiles" element={<ProfileSelect />} />
        <Route path="/profiles/new" element={<ProfileCreate />} />
        <Route path="/home" element={<Home />} />
        <Route path="/skills" element={<SkillList />} />
        <Route path="/session/setup" element={<SessionSetup />} />
        <Route path="/session/practice" element={<PracticeSession />} />
        <Route path="/session/complete" element={<SessionComplete />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/tabs" element={<TabLibrary />} />
        <Route path="/tabs/:id" element={<TabView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

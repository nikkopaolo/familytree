"use client";

import { useEffect, useMemo, useState } from "react";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { MembersTable } from "@/components/MembersTable";
import { AuthPanel } from "@/components/AuthPanel";
import { PersonDetails } from "@/components/PersonDetails";
import { StatsPanel } from "@/components/StatsPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { TabNav, type AppTab } from "@/components/TabNav";
import { TopBar } from "@/components/TopBar";
import { TreeCanvas } from "@/components/TreeCanvas";
import { useAppData } from "@/lib/useAppData";
import { calculateAge } from "@/lib/utils";

export default function Home() {
  const {
    clans,
    currentUser,
    isGuest,
    isSupabaseEnabled,
    activeClanId,
    setActiveClanId,
    clanPersons,
    clanRelationships,
    clanPositions,
    clanSuggestions,
    clanEvents,
    membership,
    isAdmin,
    branchRootIds,
    canEditPerson,
    createSuggestion,
    approveSuggestion,
    rejectSuggestion,
    applyPersonUpdate,
    uploadPersonPhoto,
    signInWithEmail,
    signOut,
    manualPositions,
    updateManualPosition,
    selectedPersonId,
    setSelectedPersonId,
    importPeople,
    importTreeJson,
    createPerson,
    createParentChildRelationship,
    createPartnerRelationship,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<AppTab>("tree");
  const [rootId, setRootId] = useState("");
  const [maxDepth, setMaxDepth] = useState(4);
  const [maxNodes, setMaxNodes] = useState(40);

  useEffect(() => {
    if (clanPersons.length > 0 && !rootId) {
      setRootId(clanPersons[0]?.id ?? "");
    }
  }, [clanPersons, rootId]);

  const selectedPerson = clanPersons.find((person) => person.id === selectedPersonId);

  const handleSubmitUpdate = async (payload: Record<string, unknown>, email?: string) => {
    if (!selectedPerson) return;
    if (canEditPerson(selectedPerson)) {
      await applyPersonUpdate(selectedPerson.id, payload);
      return;
    }
    await createSuggestion({
      clanId: activeClanId,
      targetId: selectedPerson.id,
      payload,
      creatorEmail: email,
    });
  };

  const canApprove = (personId?: string) => {
    if (isAdmin) return true;
    const person = clanPersons.find((item) => item.id === personId);
    if (!person) return false;
    return branchRootIds.has(person.branchRootId);
  };

  const quickStats = useMemo(() => {
    const aliveCount = clanPersons.filter((person) => person.isAlive).length;
    const { totalAge, count } = clanPersons.reduce(
      (acc, person) => {
        const ageValue = Number(calculateAge(person.birthDate, person.deathDate));
        if (Number.isFinite(ageValue)) {
          acc.totalAge += ageValue;
          acc.count += 1;
        }
        return acc;
      },
      { totalAge: 0, count: 0 }
    );
    const avgAge = count > 0 ? totalAge / count : 0;
    return [
      { label: "Total Members", value: clanPersons.length },
      { label: "Alive", value: aliveCount },
      { label: "Avg. Age", value: Math.round(avgAge) || "N/A" },
    ];
  }, [clanPersons]);

  return (
    <main className="pb-16">
      <TopBar
        clans={clans}
        activeClanId={activeClanId}
        onClanChange={(value) => {
          setActiveClanId(value);
          setRootId("");
          setSelectedPersonId("");
        }}
        role={membership?.role}
        user={currentUser}
        onAddMember={() => {
          createPerson({ fullName: "New Member" });
        }}
      />
      <TabNav activeTab={activeTab} onChange={setActiveTab} />
      <div className="mx-auto mt-6 grid w-[min(1200px,94vw)] grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            {quickStats.map((stat) => (
              <div key={stat.label} className="glass-card rounded-3xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>
          {activeTab === "tree" && (
            <TreeCanvas
              persons={clanPersons}
              relationships={clanRelationships}
              positions={clanPositions}
              manualPositions={manualPositions}
              onUpdatePosition={updateManualPosition}
              selectedPersonId={selectedPersonId}
              onSelectPerson={setSelectedPersonId}
              rootId={rootId}
              onRootChange={setRootId}
              maxDepth={maxDepth}
              onMaxDepthChange={setMaxDepth}
              maxNodes={maxNodes}
              onMaxNodesChange={setMaxNodes}
            />
          )}
          {activeTab === "list" && (
            <>
              <MembersTable persons={clanPersons} onSelectPerson={setSelectedPersonId} />
              <ImportExportPanel
                persons={clanPersons}
                relationships={clanRelationships}
                onImportCsv={importPeople}
                onImportJson={importTreeJson}
              />
            </>
          )}
          {activeTab === "stats" && <StatsPanel persons={clanPersons} />}
          {activeTab === "history" && <HistoryPanel events={clanEvents} persons={clanPersons} />}
          {activeTab === "suggestions" && (
            <SuggestionsPanel
              suggestions={clanSuggestions}
              persons={clanPersons}
              canApprove={canApprove}
              onApprove={approveSuggestion}
              onReject={rejectSuggestion}
            />
          )}
        </section>
        <div className="flex flex-col gap-6">
          <AuthPanel
            isSupabaseEnabled={isSupabaseEnabled}
            isGuest={isGuest}
            currentUser={currentUser}
            onSignIn={signInWithEmail}
            onSignOut={signOut}
          />
          <PersonDetails
            person={selectedPerson}
            persons={clanPersons}
            relationships={clanRelationships}
            canEdit={selectedPerson ? canEditPerson(selectedPerson) : false}
            onSubmitUpdate={handleSubmitUpdate}
            onAddParentChild={(parentId, childId) => createParentChildRelationship(parentId, childId)}
            onAddPartner={(personId, partnerId) => createPartnerRelationship(personId, partnerId)}
            canUploadPhoto={Boolean(selectedPerson && canEditPerson(selectedPerson) && isSupabaseEnabled && !isGuest)}
            onUploadPhoto={
              selectedPerson
                ? (file) => uploadPersonPhoto(selectedPerson.id, file)
                : undefined
            }
          />
        </div>
      </div>
    </main>
  );
}

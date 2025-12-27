"use client";

import { useEffect, useMemo, useState } from "react";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { MembersTable } from "@/components/MembersTable";
import { AuthPanel } from "@/components/AuthPanel";
import { PersonDetails } from "@/components/PersonDetails";
import { StatsPanel } from "@/components/StatsPanel";
import { TabNav, type AppTab } from "@/components/TabNav";
import { TopBar } from "@/components/TopBar";
import { TreeCanvas } from "@/components/TreeCanvas";
import { UpcomingBirthdays } from "@/components/UpcomingBirthdays";
import { AddChildDialog } from "@/components/AddChildDialog";
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
    clanEvents,
    membership,
    isAdmin,
    canEditPerson,
    applyPersonUpdate,
    deletePerson,
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
    deleteRelationship,
    wipeClanData,
    inviteAdmin,
    adminBootstrapError,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<AppTab>("tree");
  const [rootId, setRootId] = useState("");
  const [maxDepth, setMaxDepth] = useState(4);
  const [maxNodes, setMaxNodes] = useState(40);
  const [unlimitedGenerations, setUnlimitedGenerations] = useState(true);
  const [unlimitedNodes, setUnlimitedNodes] = useState(true);
  const [addChildParentId, setAddChildParentId] = useState<string>("");

  useEffect(() => {
    if (clanPersons.length > 0 && !rootId) {
      setRootId(clanPersons[0]?.id ?? "");
    }
  }, [clanPersons, rootId]);

  useEffect(() => {
    if (activeTab === "suggestions") {
      setActiveTab("tree");
    }
  }, [activeTab]);

  const selectedPerson = clanPersons.find((person) => person.id === selectedPersonId);
  const addChildParent = clanPersons.find((person) => person.id === addChildParentId);
  const canDeleteSelected = selectedPerson ? canEditPerson(selectedPerson) : false;

  const addChildPartners = useMemo(() => {
    if (!addChildParentId) return [];
    return clanRelationships
      .filter(
        (rel) =>
          rel.relationshipType === "partner" &&
          (rel.parentId === addChildParentId || rel.childId === addChildParentId)
      )
      .map((rel) =>
        rel.parentId === addChildParentId ? rel.childId : rel.parentId
      )
      .map((partnerId) => clanPersons.find((person) => person.id === partnerId))
      .filter(Boolean) as typeof clanPersons;
  }, [addChildParentId, clanRelationships, clanPersons]);

  const handleSubmitUpdate = async (payload: Record<string, unknown>) => {
    if (!selectedPerson) return;
    if (canEditPerson(selectedPerson)) {
      await applyPersonUpdate(selectedPerson.id, payload);
      return;
    }
    window.alert("Editing requires an invite with edit access.");
  };

  const handleInlineUpdate = async (personId: string, payload: Record<string, unknown>) => {
    const person = clanPersons.find((item) => item.id === personId);
    if (!person) return;
    if (canEditPerson(person)) {
      await applyPersonUpdate(person.id, payload);
      return;
    }
    window.alert("Editing requires an invite with edit access.");
  };

  const handleBulkLocationUpdate = async (ids: string[], location: string) => {
    const editableIds = ids.filter((id) => {
      const person = clanPersons.find((item) => item.id === id);
      return person ? canEditPerson(person) : false;
    });
    if (editableIds.length === 0) {
      window.alert("Editing requires an invite with edit access.");
      return;
    }
    await Promise.all(editableIds.map((id) => applyPersonUpdate(id, { location })));
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
        role={membership?.role}
        user={currentUser}
        onInviteAdmin={async () => {
          const email = window.prompt("Invite admin by email");
          if (!email) return;
          const result = await inviteAdmin(email, activeClanId);
          if (result.error) {
            window.alert(result.error);
            return;
          }
          window.alert("Admin invite sent.");
        }}
        onAddMember={() => {
          createPerson({ fullName: "New Member" });
        }}
      />
      <TabNav activeTab={activeTab} onChange={setActiveTab} showSuggestions={false} />
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
              canEditPerson={canEditPerson}
              onAddChild={(parentId) => setAddChildParentId(parentId)}
              onAddPartner={async (personId) => {
                const newPerson = await createPerson({ fullName: "New Member" });
                if (newPerson) {
                  await createPartnerRelationship(personId, newPerson.id);
                  setSelectedPersonId(newPerson.id);
                }
              }}
              onUpdatePerson={handleInlineUpdate}
              onDeleteRelationship={deleteRelationship}
              onLinkParent={(childId, parentId) =>
                createParentChildRelationship(parentId, childId)
              }
              onLinkChild={(parentId, childId) =>
                createParentChildRelationship(parentId, childId)
              }
              onLinkPartner={(personId, partnerId) =>
                createPartnerRelationship(personId, partnerId)
              }
              onUpdatePosition={updateManualPosition}
              selectedPersonId={selectedPersonId}
              onSelectPerson={setSelectedPersonId}
              rootId={rootId}
              onRootChange={setRootId}
              maxDepth={unlimitedGenerations ? Number.POSITIVE_INFINITY : maxDepth}
              onMaxDepthChange={setMaxDepth}
              maxDepthValue={maxDepth}
              isMaxDepthUnlimited={unlimitedGenerations}
              onToggleMaxDepthUnlimited={setUnlimitedGenerations}
              maxNodes={unlimitedNodes ? Number.POSITIVE_INFINITY : maxNodes}
              onMaxNodesChange={setMaxNodes}
              maxNodesValue={maxNodes}
              isMaxNodesUnlimited={unlimitedNodes}
              onToggleMaxNodesUnlimited={setUnlimitedNodes}
            />
          )}
          {activeTab === "list" && (
            <>
              <MembersTable
                persons={clanPersons}
                onSelectPerson={setSelectedPersonId}
                selectedPersonId={selectedPersonId}
                canEditPerson={canEditPerson}
                canDeleteSelected={canDeleteSelected}
                canWipe={isAdmin}
                onDeletePerson={deletePerson}
                onWipeList={wipeClanData}
                onBulkUpdateLocation={handleBulkLocationUpdate}
              />
              <ImportExportPanel
                persons={clanPersons}
                relationships={clanRelationships}
                onImportCsv={importPeople}
                onImportJson={importTreeJson}
              />
            </>
          )}
          {activeTab === "stats" && (
            <StatsPanel persons={clanPersons} relationships={clanRelationships} />
          )}
          {activeTab === "history" && <HistoryPanel events={clanEvents} persons={clanPersons} />}
        </section>
        <div className="flex flex-col gap-6">
          <AuthPanel
            isSupabaseEnabled={isSupabaseEnabled}
            isGuest={isGuest}
            currentUser={currentUser}
            role={membership?.role}
            onSignIn={signInWithEmail}
            onSignOut={signOut}
            adminBootstrapError={adminBootstrapError}
          />
          <UpcomingBirthdays persons={clanPersons} />
          <PersonDetails
            person={selectedPerson}
            persons={clanPersons}
            relationships={clanRelationships}
            canEdit={selectedPerson ? canEditPerson(selectedPerson) : false}
            onSubmitUpdate={handleSubmitUpdate}
            onAddParentChild={(parentId, childId) => createParentChildRelationship(parentId, childId)}
            onAddPartner={(personId, partnerId) => createPartnerRelationship(personId, partnerId)}
            onDelete={deletePerson}
            canUploadPhoto={Boolean(selectedPerson && canEditPerson(selectedPerson) && isSupabaseEnabled && !isGuest)}
            onUploadPhoto={
              selectedPerson
                ? (file) => uploadPersonPhoto(selectedPerson.id, file)
                : undefined
            }
          />
        </div>
      </div>
      <AddChildDialog
        isOpen={Boolean(addChildParentId)}
        parent={addChildParent}
        partners={addChildPartners}
        onClose={() => setAddChildParentId("")}
        onConfirm={async ({ fullName, partnerIds }) => {
          if (!addChildParentId) return;
          const newPerson = await createPerson({
            fullName: fullName.trim() || "New Member",
          });
          if (newPerson) {
            await createParentChildRelationship(addChildParentId, newPerson.id);
            for (const partnerId of partnerIds) {
              await createParentChildRelationship(partnerId, newPerson.id);
            }
            setSelectedPersonId(newPerson.id);
          }
          setAddChildParentId("");
        }}
      />
    </main>
  );
}

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
    updateRelationship,
    deleteRelationship,
    wipeClanData,
    inviteAdmin,
    adminBootstrapError,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<AppTab>("tree");
  const [rootId, setRootId] = useState("all");
  const [maxDepth, setMaxDepth] = useState(4);
  const [maxNodes, setMaxNodes] = useState(40);
  const [unlimitedGenerations, setUnlimitedGenerations] = useState(true);
  const [unlimitedNodes, setUnlimitedNodes] = useState(true);
  const [addChildParentId, setAddChildParentId] = useState<string>("");
  const [statsMonth, setStatsMonth] = useState<number | null>(null);

  useEffect(() => {
    if (clanPersons.length === 0) return;
    if (!rootId || (rootId !== "all" && !clanPersons.some((person) => person.id === rootId))) {
      setRootId("all");
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
    const totalMembers = clanPersons.length;
    const aliveCount = clanPersons.filter((person) => person.isAlive).length;
    const deceasedCount = totalMembers - aliveCount;
    const aliveRate = totalMembers > 0 ? Math.round((aliveCount / totalMembers) * 100) : 0;
    const ages = clanPersons
      .map((person) => Number(calculateAge(person.birthDate, person.deathDate)))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    const avgAge =
      ages.length > 0 ? ages.reduce((sum, value) => sum + value, 0) / ages.length : 0;
    const medianAge =
      ages.length === 0
        ? null
        : ages.length % 2 === 1
          ? ages[Math.floor(ages.length / 2)]
          : (ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2;
    const partnerLinks = clanRelationships.filter(
      (rel) => rel.relationshipType === "partner"
    ).length;
    const birthdaysKnown = clanPersons.filter((person) => person.birthDate).length;
    const birthdayRate =
      totalMembers > 0 ? Math.round((birthdaysKnown / totalMembers) * 100) : 0;
    const photosCount = clanPersons.filter((person) => person.photoUrl).length;
    const photoRate =
      totalMembers > 0 ? Math.round((photosCount / totalMembers) * 100) : 0;

    return [
      {
        label: "Total Members",
        value: totalMembers,
        sub: `${aliveCount} alive • ${deceasedCount} deceased`,
      },
      {
        label: "Alive Rate",
        value: `${aliveRate}%`,
        sub: "Share of living members",
      },
      {
        label: "Avg. Age",
        value: Math.round(avgAge) || "N/A",
        sub: medianAge ? `Median ${Math.round(medianAge)}` : "Median N/A",
      },
      {
        label: "Linked Couples",
        value: partnerLinks,
        sub: "Partner relationships",
      },
      {
        label: "Birthdays Known",
        value: birthdaysKnown,
        sub: `${birthdayRate}% recorded`,
      },
      {
        label: "Photos",
        value: photosCount,
        sub: `${photoRate}% with photos`,
      },
    ];
  }, [clanPersons, clanRelationships]);

  return (
    <main className="pb-12 px-4">
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
      <div className="mx-auto mt-4 grid w-full max-w-none grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col gap-6">
          <div className="glass-card rounded-3xl px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
          {activeTab === "tree" && (
            <>
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
                onLinkPartner={(personId, partnerId, marriageDate) =>
                  createPartnerRelationship(personId, partnerId, marriageDate)
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
              <PersonDetails
                person={selectedPerson}
                persons={clanPersons}
                relationships={clanRelationships}
                canEdit={selectedPerson ? canEditPerson(selectedPerson) : false}
                onSubmitUpdate={handleSubmitUpdate}
                onAddParentChild={(parentId, childId) =>
                  createParentChildRelationship(parentId, childId)
                }
                onAddPartner={(personId, partnerId, marriageDate) =>
                  createPartnerRelationship(personId, partnerId, marriageDate)
                }
                onUpdateRelationship={updateRelationship}
                onDelete={deletePerson}
                canUploadPhoto={Boolean(
                  selectedPerson && canEditPerson(selectedPerson) && isSupabaseEnabled && !isGuest
                )}
                onUploadPhoto={
                  selectedPerson
                    ? (file) => uploadPersonPhoto(selectedPerson.id, file)
                    : undefined
                }
              />
            </>
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
            <StatsPanel
              persons={clanPersons}
              relationships={clanRelationships}
              forcedMonth={statsMonth}
              onMonthChange={setStatsMonth}
            />
          )}
          {activeTab === "history" && <HistoryPanel events={clanEvents} persons={clanPersons} />}
        </section>
        <div className="flex flex-col gap-6">
          <UpcomingBirthdays
            persons={clanPersons}
            relationships={clanRelationships}
            onSelectDate={(date) => {
              setStatsMonth(date.getMonth());
              setActiveTab("stats");
            }}
          />
          <AuthPanel
            isSupabaseEnabled={isSupabaseEnabled}
            isGuest={isGuest}
            currentUser={currentUser}
            role={membership?.role}
            onSignIn={signInWithEmail}
            onSignOut={signOut}
            adminBootstrapError={adminBootstrapError}
          />
          {activeTab !== "tree" && (
            <PersonDetails
              person={selectedPerson}
              persons={clanPersons}
              relationships={clanRelationships}
              canEdit={selectedPerson ? canEditPerson(selectedPerson) : false}
              onSubmitUpdate={handleSubmitUpdate}
              onAddParentChild={(parentId, childId) =>
                createParentChildRelationship(parentId, childId)
              }
              onAddPartner={(personId, partnerId, marriageDate) =>
                createPartnerRelationship(personId, partnerId, marriageDate)
              }
              onUpdateRelationship={updateRelationship}
              onDelete={deletePerson}
              canUploadPhoto={Boolean(
                selectedPerson && canEditPerson(selectedPerson) && isSupabaseEnabled && !isGuest
              )}
              onUploadPhoto={
                selectedPerson
                  ? (file) => uploadPersonPhoto(selectedPerson.id, file)
                  : undefined
              }
            />
          )}
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

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ApiError,
  conversationsApi,
  jobsApi,
  profileApi,
  proposalsApi,
  type Conversation,
  type Currency,
  type Job,
  type Message,
  type Profile,
  type Proposal,
  type Role,
  type User,
} from "../api";

type Tab = "jobs" | "proposals" | "messages" | "profile";
type Props = { user: User; token: string; onSignOut: () => void };
const purple = "#7257e8";

export function Marketplace({ user, token, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>("jobs");
  const [profile, setProfile] = useState<Profile | null>(user.profile ?? null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileHeadline, setProfileHeadline] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileSkills, setProfileSkills] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobProposals, setJobProposals] = useState<Proposal[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBudgetMin, setNewBudgetMin] = useState("");
  const [newBudgetMax, setNewBudgetMax] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("USD");
  const [newBudgetType, setNewBudgetType] = useState<Job["budgetType"]>("FIXED");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isFreelancer = user.role === "FREELANCER";
  const isClient = user.role === "CLIENT";
  const name = profile?.displayName || user.email.split("@")[0];

  useEffect(() => {
    if (!profile) return;
    setProfileName(profile.displayName);
    setProfileHeadline(profile.headline ?? "");
    setProfileLocation(profile.location ?? "");
    setProfileBio(profile.bio ?? "");
    setProfileSkills(profile.skills.join(", "));
  }, [profile]);

  const load = useCallback(async (search = "") => {
    setError("");
    try {
      const [jobResult, profileResult, conversationResult] = await Promise.all([
        isClient ? jobsApi.mine(token, 100) : jobsApi.list({ q: search || undefined, limit: 100 }),
        profileApi.me(token),
        conversationsApi.list(token),
      ]);
      setJobs(Array.isArray(jobResult) ? jobResult : jobResult.data);
      setProfile(profileResult);
      setConversations(conversationResult);
      if (isFreelancer) setProposals(await proposalsApi.mine(token));
      else setProposals([]);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load your Archer data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient, isFreelancer, token, user.id]);

  useEffect(() => { void load(""); }, [load]);

  useEffect(() => {
    if (!selectedConversation) return;
    let active = true;
    conversationsApi.messages(token, selectedConversation.id)
      .then((items) => { if (active) setMessages(items); })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : "Could not load messages."); });
    return () => { active = false; };
  }, [selectedConversation, token]);

  const openJob = async (job: Job) => {
    setSelectedJob(job);
    setJobProposals([]);
    setCoverLetter("");
    setBidAmount("");
    setError("");
    try {
      const fullJob = await jobsApi.get(job.id);
      setSelectedJob(fullJob);
      if (isClient) setJobProposals(await proposalsApi.forJob(token, job.id));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load this job.");
    }
  };

  const submitProposal = async () => {
    if (!selectedJob) return;
    if (coverLetter.trim().length < 20) {
      setError("Introduce yourself in at least 20 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await proposalsApi.submit(token, selectedJob.id, {
        coverLetter: coverLetter.trim(),
        ...(bidAmount.trim() ? { bidAmount: bidAmount.trim() } : {}),
      });
      setSelectedJob(null);
      await load(query);
      Alert.alert("Proposal sent", "A conversation with the client is ready in your inbox.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not send your proposal.");
    } finally {
      setBusy(false);
    }
  };

  const closeJob = async () => {
    if (!selectedJob) return;
    setBusy(true);
    setError("");
    try {
      await jobsApi.close(token, selectedJob.id);
      setSelectedJob(null);
      await load(query);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not close this job.");
    } finally {
      setBusy(false);
    }
  };

  const rejectProposal = async (proposal: Proposal) => {
    setBusy(true);
    try {
      const updated = await proposalsApi.reject(token, proposal.id);
      setJobProposals((current) => current.map((item) => item.id === updated.id ? updated : item));
      await load(query);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not reject this proposal.");
    } finally {
      setBusy(false);
    }
  };

  const withdrawProposal = async (proposal: Proposal) => {
    setBusy(true);
    try {
      const updated = await proposalsApi.withdraw(token, proposal.id);
      setProposals((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not withdraw this proposal.");
    } finally {
      setBusy(false);
    }
  };

  const createJob = async () => {
    if (newTitle.trim().length < 5 || newDescription.trim().length < 30) {
      setError("Use a title of at least 5 characters and a description of at least 30.");
      return;
    }
    if (Boolean(newBudgetMin.trim()) !== Boolean(newBudgetMax.trim())) {
      setError("Enter both ends of the budget range, or leave both blank.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await jobsApi.create(token, {
        title: newTitle.trim(),
        description: newDescription.trim(),
        budgetType: newBudgetType,
        currency: newCurrency,
        ...(newBudgetMin.trim() ? { budgetMin: newBudgetMin.trim(), budgetMax: newBudgetMax.trim() } : {}),
      });
      setShowNewJob(false);
      setNewTitle("");
      setNewDescription("");
      setNewBudgetMin("");
      setNewBudgetMax("");
      setTab("jobs");
      await load("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not publish this job.");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !draftMessage.trim()) return;
    setBusy(true);
    try {
      const message = await conversationsApi.send(token, selectedConversation.id, draftMessage.trim());
      setMessages((current) => [...current, message]);
      setDraftMessage("");
      await load(query);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      setError("Your name cannot be blank.");
      return;
    }
    const skills = profileSkills.split(",").map((skill) => skill.trim()).filter(Boolean);
    if (skills.length > 30 || skills.some((skill) => skill.length > 40)) {
      setError("Add up to 30 skills, with each skill no longer than 40 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updatedProfile = await profileApi.update(token, {
        displayName: profileName.trim(),
        headline: profileHeadline.trim() || null,
        location: profileLocation.trim() || null,
        bio: profileBio.trim() || null,
        skills,
      });
      setProfile(updatedProfile);
      setEditingProfile(false);
      Alert.alert("Profile saved", "Your profile has been updated.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const beginSearch = () => {
    setQuery(searchText.trim());
    setLoading(true);
    void load(searchText.trim());
  };

  const refresh = () => {
    setRefreshing(true);
    void load(query);
  };

  const heading = tab === "jobs" ? (isClient ? "Your open jobs" : "Find your next project")
    : tab === "proposals" ? (isClient ? "Review proposals" : "Your proposals")
      : tab === "messages" ? "Messages" : "Your profile";

  if (selectedConversation) {
    return (
      <PageShell title={selectedConversation.job.title} onBack={() => setSelectedConversation(null)}>
        <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageBubble, message.senderId === user.id ? styles.myMessage : styles.theirMessage]}>
              <Text style={styles.messageBody}>{message.body}</Text>
              <Text style={styles.messageTime}>{new Date(message.createdAt).toLocaleString()}</Text>
            </View>
          ))}
          {messages.length === 0 && <EmptyState title="Start the conversation" body="Send a message about the project." />}
        </ScrollView>
        {error ? <InlineError message={error} /> : null}
        <View style={styles.composer}>
          <TextInput value={draftMessage} onChangeText={setDraftMessage} placeholder="Write a message" multiline style={styles.composerInput} />
          <Pressable onPress={() => void sendMessage()} disabled={busy || !draftMessage.trim()} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </PageShell>
    );
  }

  if (selectedJob) {
    return (
      <PageShell title="Project details" onBack={() => setSelectedJob(null)}>
        <ScrollView contentContainerStyle={styles.pageBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>{selectedJob.budgetType === "FIXED" ? "FIXED PRICE" : "HOURLY"} PROJECT</Text>
          <Text style={styles.detailTitle}>{selectedJob.title}</Text>
          <Text style={styles.muted}>Posted by {selectedJob.client?.profile?.displayName ?? "Archer client"}</Text>
          <View style={styles.detailBudget}><Text style={styles.detailBudgetText}>{budgetLabel(selectedJob)}</Text></View>
          <Text style={styles.sectionTitle}>About the project</Text>
          <Text style={styles.detailDescription}>{selectedJob.description}</Text>

          {isFreelancer && selectedJob.status === "OPEN" && (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Send a proposal</Text>
              <Field label="Introduction" value={coverLetter} onChangeText={setCoverLetter} placeholder="Tell the client why you’re a good fit" multiline />
              <Field label={`Your bid (${selectedJob.currency}, optional)`} value={bidAmount} onChangeText={setBidAmount} placeholder="0.00" keyboardType="decimal-pad" />
              {error ? <InlineError message={error} /> : null}
              <PrimaryButton label="Send proposal" onPress={() => void submitProposal()} disabled={busy} />
            </View>
          )}

          {isClient && (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Proposals ({jobProposals.length})</Text>
              {jobProposals.length ? jobProposals.map((proposal) => (
                <View key={proposal.id} style={styles.proposalCard}>
                  <Text style={styles.cardTitle}>{proposal.freelancer?.profile?.displayName ?? "Freelancer"}</Text>
                  <Text style={styles.cardBody}>{proposal.coverLetter}</Text>
                  <Text style={styles.muted}>{proposal.bidAmount ? `${proposal.bidAmount} ${proposal.currency}` : "No bid"} · {proposal.status}</Text>
                  {proposal.status === "PENDING" && <SmallButton label="Reject proposal" onPress={() => void rejectProposal(proposal)} />}
                </View>
              )) : <Text style={styles.muted}>No proposals yet.</Text>}
              {selectedJob.status === "OPEN" && <SecondaryButton label="Close this job" onPress={() => void closeJob()} disabled={busy} />}
            </View>
          )}
        </ScrollView>
      </PageShell>
    );
  }

  if (showNewJob) {
    return (
      <PageShell title="Post a project" onBack={() => { setShowNewJob(false); setError(""); }}>
        <ScrollView contentContainerStyle={styles.pageBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.detailTitle}>Tell freelancers what you need.</Text>
          <Field label="Project title" value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Build a small business website" />
          <Field label="Project description" value={newDescription} onChangeText={setNewDescription} placeholder="Describe the scope, goals, and deliverables" multiline />
          <Text style={styles.fieldLabel}>Budget type</Text>
          <ChoiceRow values={["FIXED", "HOURLY"]} selected={newBudgetType} onSelect={(value) => setNewBudgetType(value as Job["budgetType"])} />
          <Text style={styles.fieldLabel}>Currency</Text>
          <ChoiceRow values={["USD", "MMK"]} selected={newCurrency} onSelect={(value) => setNewCurrency(value as Currency)} />
          <View style={styles.rowFields}>
            <Field label="Minimum (optional)" value={newBudgetMin} onChangeText={setNewBudgetMin} placeholder="0" keyboardType="decimal-pad" />
            <Field label="Maximum" value={newBudgetMax} onChangeText={setNewBudgetMax} placeholder="0" keyboardType="decimal-pad" />
          </View>
          {error ? <InlineError message={error} /> : null}
          <PrimaryButton label="Publish project" onPress={() => void createJob()} disabled={busy} />
        </ScrollView>
      </PageShell>
    );
  }

  return (
    <PageShell title={heading}>
      {tab !== "profile" && <View style={styles.greeting}>
        <View style={styles.greetingText}>
          <Text style={styles.eyebrow}>{isFreelancer ? "FREELANCER" : isClient ? "CLIENT WORKSPACE" : "ARCHER"}</Text>
          <Text style={styles.greetingTitle}>Hi, {name}</Text>
          <Text style={styles.muted}>{isFreelancer ? "Find a project that fits your skills." : isClient ? "Find the right people for your work." : "Admin workflows aren’t available yet."}</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
      </View>}

      {isClient && tab === "jobs" && <PrimaryButton label="＋  Post a project" onPress={() => { setError(""); setShowNewJob(true); }} />}
      {isFreelancer && tab === "jobs" && (
        <View style={styles.searchRow}>
          <TextInput value={searchText} onChangeText={setSearchText} placeholder="Search open projects" returnKeyType="search" onSubmitEditing={beginSearch} style={styles.searchInput} />
          <Pressable onPress={beginSearch} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable>
        </View>
      )}

      {error ? <InlineError message={error} onRetry={() => void load(query)} /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={purple} /><Text style={styles.muted}>Loading your Archer workspace…</Text></View>
      ) : tab === "profile" ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.profileContent} keyboardShouldPersistTaps="handled">
          <ProfilePanel
            profile={profile}
            role={user.role}
            email={user.email}
            onSignOut={onSignOut}
            editing={editingProfile}
            busy={busy}
            displayName={profileName}
            headline={profileHeadline}
            location={profileLocation}
            bio={profileBio}
            skills={profileSkills}
            onEdit={() => { setError(""); setEditingProfile(true); }}
            onCancel={() => { setError(""); setEditingProfile(false); if (profile) { setProfileName(profile.displayName); setProfileHeadline(profile.headline ?? ""); setProfileLocation(profile.location ?? ""); setProfileBio(profile.bio ?? ""); setProfileSkills(profile.skills.join(", ")); } }}
            onSave={() => void saveProfile()}
            onDisplayNameChange={setProfileName}
            onHeadlineChange={setProfileHeadline}
            onLocationChange={setProfileLocation}
            onBioChange={setProfileBio}
            onSkillsChange={setProfileSkills}
          />
        </ScrollView>
      ) : (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={purple} />}>
          {tab === "jobs" && (isFreelancer
            ? jobs.map((job) => <JobCard key={job.id} job={job} onPress={() => void openJob(job)} />)
            : isClient
              ? jobs.map((job) => <JobCard key={job.id} job={job} own onPress={() => void openJob(job)} />)
              : <EmptyState title="No admin workspace yet" body="Admin features have not been defined for Archer." />)}
          {tab === "proposals" && (isFreelancer
            ? proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} onWithdraw={() => void withdrawProposal(proposal)} disabled={busy} />)
            : isClient
              ? jobs.map((job) => <JobCard key={job.id} job={job} own onPress={() => void openJob(job)} actionLabel={`Review ${job._count?.proposals ?? 0} proposals`} />)
              : null)}
          {tab === "messages" && conversations.map((conversation) => (
            <ConversationCard key={conversation.id} conversation={conversation} currentUserId={user.id} onPress={() => { setMessages([]); setSelectedConversation(conversation); }} />
          ))}
          {tab === "jobs" && jobs.length === 0 && <EmptyState title={isClient ? "No open projects yet" : "No projects found"} body={isClient ? "Publish your first project and it will appear here." : "Try another search or check back soon for new work."} />}
          {tab === "proposals" && isFreelancer && proposals.length === 0 && <EmptyState title="No proposals yet" body="When you apply to a project, you can track your proposal here." />}
          {tab === "proposals" && isClient && jobs.length === 0 && <EmptyState title="No projects to review" body="Publish a project before reviewing freelancer proposals." />}
          {tab === "messages" && conversations.length === 0 && <EmptyState title="Your inbox is quiet" body={isFreelancer ? "Submitting a proposal opens a conversation with the client." : "Conversations appear when a freelancer applies to your project."} />}
        </ScrollView>
      )}
      <BottomTabs
        firstLabel={isClient ? "My jobs" : "Browse"}
        tab={tab}
        proposalCount={isFreelancer ? proposals.length : undefined}
        messageCount={conversations.length}
        onChange={setTab}
      />
    </PageShell>
  );
}

function PageShell({ title, onBack, children }: { title: string; onBack?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        {onBack ? <Pressable onPress={onBack} hitSlop={10} style={styles.back}><Text style={styles.backText}>‹  Back</Text></Pressable> : <Text style={styles.logo}>archer</Text>}
        <Text numberOfLines={1} style={styles.topTitle}>{title}</Text>
        <View style={styles.topBarRight} />
      </View>
      {children}
    </View>
  );
}

function JobCard({ job, own, onPress, actionLabel }: { job: Job; own?: boolean; onPress: () => void; actionLabel?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}><Text style={styles.eyebrow}>{job.budgetType === "FIXED" ? "FIXED PRICE" : "HOURLY"}</Text><Text style={styles.cardDate}>{relativeDate(job.createdAt)}</Text></View>
      <Text style={styles.cardTitle}>{job.title}</Text>
      <Text numberOfLines={3} style={styles.cardBody}>{job.description}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cardBudget}>{budgetLabel(job)}</Text>
        <Text style={styles.cardMeta}>{actionLabel ?? (own ? `${job._count?.proposals ?? 0} proposals` : job.client?.profile?.displayName ?? "Archer client")}</Text>
      </View>
    </Pressable>
  );
}

function ProposalCard({ proposal, onWithdraw, disabled }: { proposal: Proposal; onWithdraw: () => void; disabled: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{proposal.status}</Text>
      <Text style={styles.cardTitle}>{proposal.job?.title ?? "Project proposal"}</Text>
      <Text numberOfLines={3} style={styles.cardBody}>{proposal.coverLetter}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cardBudget}>{proposal.bidAmount ? `${proposal.bidAmount} ${proposal.currency}` : "No bid"}</Text>
        {proposal.status === "PENDING" && <SmallButton label="Withdraw" onPress={onWithdraw} disabled={disabled} />}
      </View>
    </View>
  );
}

function ConversationCard({ conversation, currentUserId, onPress }: { conversation: Conversation; currentUserId: string; onPress: () => void }) {
  const other = conversation.clientId === currentUserId ? conversation.freelancer : conversation.client;
  const last = conversation.messages[0];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}><Text style={styles.eyebrow}>{other.profile?.displayName ?? "Conversation"}</Text><Text style={styles.cardDate}>{last ? relativeDate(last.createdAt) : "New"}</Text></View>
      <Text style={styles.cardTitle}>{conversation.job.title}</Text>
      <Text numberOfLines={2} style={styles.cardBody}>{last?.body ?? "Send the first message about this project."}</Text>
    </Pressable>
  );
}

type ProfilePanelProps = {
  profile: Profile | null;
  role: Role;
  email: string;
  onSignOut: () => void;
  editing: boolean;
  busy: boolean;
  displayName: string;
  headline: string;
  location: string;
  bio: string;
  skills: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDisplayNameChange: (value: string) => void;
  onHeadlineChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onSkillsChange: (value: string) => void;
};

function ProfilePanel(props: ProfilePanelProps) {
  const roleLabel = props.role === "FREELANCER" ? "Freelancer" : props.role === "CLIENT" ? "Client" : "Admin";
  return (
    <>
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(props.profile?.displayName || props.email).slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.profileHeroName}>{props.profile?.displayName || "Your profile"}</Text>
        <Text style={styles.profileRole}>{roleLabel} account</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileAccountHeading}>Account</Text>
        <ProfileValue label="Email address" value={props.email} />
        <ProfileValue label="Account type" value={roleLabel} />
        <Pressable accessibilityRole="button" onPress={props.onSignOut} style={styles.profileSignOut}>
          <Text style={styles.profileSignOutText}>Sign out</Text>
        </Pressable>
        <View style={styles.profileSectionDivider} />
        <View style={styles.profileCardHeading}>
          <Text style={styles.sectionTitle}>{props.editing ? "Edit profile" : "About you"}</Text>
          {!props.editing && <SmallButton label="Edit" onPress={props.onEdit} />}
        </View>
        {props.editing ? (
          <>
            <Field label="Display name" value={props.displayName} onChangeText={props.onDisplayNameChange} placeholder="Your name" autoCapitalize="words" />
            <Field label="Headline" value={props.headline} onChangeText={props.onHeadlineChange} placeholder="What do you do?" />
            <Field label="Location" value={props.location} onChangeText={props.onLocationChange} placeholder="City, country" />
            <Field label="About" value={props.bio} onChangeText={props.onBioChange} placeholder="Share a little about yourself" multiline />
            <Field label="Skills (separate with commas)" value={props.skills} onChangeText={props.onSkillsChange} placeholder="Design, writing, development" multiline />
            <View style={styles.profileActions}>
              <SecondaryButton label="Cancel" onPress={props.onCancel} disabled={props.busy} />
              <PrimaryButton label={props.busy ? "Saving…" : "Save profile"} onPress={props.onSave} disabled={props.busy} />
            </View>
          </>
        ) : (
          <>
            <ProfileValue label="Headline" value={props.profile?.headline} fallback="Add a short headline" />
            <ProfileValue label="Location" value={props.profile?.location} fallback="Add your location" />
            <ProfileValue label="About" value={props.profile?.bio} fallback="Tell people about yourself" multiline />
            <ProfileValue label="Skills" value={props.profile?.skills.join(", ")} fallback="Add your skills" multiline />
          </>
        )}
      </View>
    </>
  );
}

function ProfileValue({ label, value, fallback, multiline }: { label: string; value?: string | null; fallback?: string; multiline?: boolean }) {
  return (
    <View style={styles.profileValue}>
      <Text style={styles.profileValueLabel}>{label}</Text>
      <Text style={[styles.profileValueText, !value && styles.profileFallback, multiline && styles.profileMultiline]}>{value || fallback || "—"}</Text>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...input} placeholderTextColor="#9a9893" style={[styles.input, input.multiline && styles.multiline]} textAlignVertical={input.multiline ? "top" : "center"} /></View>;
}

function ChoiceRow({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.choiceRow}>{values.map((value) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.choice, selected === value && styles.choiceSelected]}><Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{value}</Text></Pressable>)}</View>;
}

function BottomTabs({ firstLabel, tab, proposalCount, messageCount, onChange }: { firstLabel: string; tab: Tab; proposalCount?: number; messageCount: number; onChange: (tab: Tab) => void }) {
  const items: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: "jobs", label: firstLabel, icon: "⌕" },
    { key: "proposals", label: "Proposals", icon: "◇", count: proposalCount },
    { key: "messages", label: "Messages", icon: "✉", count: messageCount },
    { key: "profile", label: "Profile", icon: "●" },
  ];
  return (
    <View style={styles.bottomTabs}>
      {items.map((item) => {
        const selected = tab === item.key;
        return (
          <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(item.key)} style={styles.bottomTab}>
            <View style={styles.bottomIconWrap}>
              <Text style={[styles.bottomIcon, selected && styles.bottomIconSelected]}>{item.icon}</Text>
              {!!item.count && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{item.count > 99 ? "99+" : item.count}</Text></View>}
            </View>
            <Text style={[styles.bottomTabLabel, selected && styles.bottomTabLabelSelected]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, disabled && styles.disabled]}><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryButton, disabled && styles.disabled]}><Text style={styles.secondaryText}>{label}</Text></Pressable>;
}

function SmallButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.smallButton, disabled && styles.disabled]}><Text style={styles.smallButtonText}>{label}</Text></Pressable>;
}

function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.errorBox}><Text style={styles.errorText}>{message}</Text>{onRetry && <Pressable onPress={onRetry}><Text style={styles.retry}>Retry</Text></Pressable>}</View>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><View style={styles.emptyMark}><Text style={styles.emptyMarkText}>✦</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function budgetLabel(job: Job) {
  const suffix = job.budgetType === "HOURLY" ? " / hr" : "";
  if (!job.budgetMin || !job.budgetMax) return `Budget open · ${job.currency}${suffix}`;
  return `${job.budgetMin}–${job.budgetMax} ${job.currency}${suffix}`;
}

function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8f7f4" },
  topBar: { minHeight: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#ebe9e3" },
  logo: { color: purple, fontSize: 19, fontWeight: "800", width: 70 },
  topTitle: { color: "#292824", fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center", paddingHorizontal: 8 },
  topBarRight: { width: 70 },
  back: { width: 70 }, backText: { color: purple, fontSize: 14, fontWeight: "700" },
  greeting: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 17, gap: 12 },
  greetingText: { flex: 1 }, eyebrow: { color: purple, fontSize: 10, letterSpacing: 1.4, fontWeight: "800", marginBottom: 7 },
  greetingTitle: { color: "#232220", fontSize: 25, fontWeight: "700", letterSpacing: -0.6, marginBottom: 5 },
  muted: { color: "#77756f", fontSize: 13, lineHeight: 19 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#e9e5fc", alignItems: "center", justifyContent: "center" }, avatarText: { color: purple, fontSize: 20, fontWeight: "700" },
  primaryButton: { minHeight: 49, borderRadius: 14, marginHorizontal: 20, marginBottom: 15, backgroundColor: purple, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "700" }, buttonPressed: { backgroundColor: "#5c43ce" }, disabled: { opacity: 0.55 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 15 },
  searchInput: { flex: 1, minHeight: 47, borderRadius: 13, borderWidth: 1, borderColor: "#e2e0da", backgroundColor: "#fff", paddingHorizontal: 13, color: "#292824", fontSize: 14 },
  searchButton: { paddingHorizontal: 15, borderRadius: 13, backgroundColor: "#eeebff", alignItems: "center", justifyContent: "center" }, searchButtonText: { color: purple, fontWeight: "700", fontSize: 13 },
  bottomTabs: { height: 66, flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e9e7e1", backgroundColor: "#fff", paddingHorizontal: 7 },
  bottomTab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  bottomIconWrap: { minWidth: 28, alignItems: "center", justifyContent: "center" },
  bottomIcon: { color: "#9b9891", fontSize: 21, lineHeight: 24 }, bottomIconSelected: { color: purple },
  bottomTabLabel: { color: "#8c8982", fontSize: 10, fontWeight: "600" }, bottomTabLabelSelected: { color: purple, fontWeight: "800" },
  countBadge: { position: "absolute", top: -4, right: -16, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: purple, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  countBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  listScroll: { flex: 1 },
  profileContent: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 30 },
  profileHero: { alignItems: "center", paddingVertical: 22, marginBottom: 12 },
  profileAvatar: { width: 76, height: 76, borderRadius: 26, backgroundColor: "#e9e5fc", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  profileAvatarText: { color: purple, fontSize: 30, fontWeight: "700" },
  profileHeroName: { color: "#262521", fontSize: 21, fontWeight: "700" },
  profileRole: { color: "#85827b", fontSize: 13, marginTop: 5 },
  profileCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eeece7", borderRadius: 18, padding: 16, marginBottom: 13 },
  profileCardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  profileSectionDivider: { height: 1, backgroundColor: "#eeece7", marginTop: 8, marginBottom: 17 },
  profileAccountHeading: { color: "#33322e", fontSize: 16, fontWeight: "700", marginBottom: 2 },
  profileSignOut: { minHeight: 46, borderRadius: 12, backgroundColor: "#f5f2f1", alignItems: "center", justifyContent: "center", marginTop: 10 },
  profileSignOutText: { color: "#8e4c45", fontSize: 13, fontWeight: "700" },
  profileActions: { gap: 8, marginTop: 4 },
  profileValue: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f0efeb" },
  profileValueLabel: { color: "#8a877f", fontSize: 11, fontWeight: "700", marginBottom: 5 },
  profileValueText: { color: "#35342f", fontSize: 14, lineHeight: 20 },
  profileFallback: { color: "#aaa79f" },
  profileMultiline: { lineHeight: 22 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eeece7", borderRadius: 18, padding: 16, marginBottom: 12 }, cardPressed: { opacity: 0.8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, cardDate: { color: "#a09d96", fontSize: 11 },
  cardTitle: { color: "#282723", fontSize: 16, lineHeight: 22, fontWeight: "700", marginTop: 6 },
  cardBody: { color: "#73716a", fontSize: 13, lineHeight: 19, marginTop: 7 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#f0efeb" },
  cardBudget: { color: "#34332f", fontSize: 12, fontWeight: "700" }, cardMeta: { color: "#918e87", fontSize: 11 },
  loading: { flex: 1, paddingTop: 45, alignItems: "center", gap: 12 },
  empty: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 55 }, emptyMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#eeebff", alignItems: "center", justifyContent: "center", marginBottom: 15 }, emptyMarkText: { color: purple, fontSize: 20 },
  emptyTitle: { color: "#33322e", fontSize: 16, fontWeight: "700", textAlign: "center" }, emptyBody: { color: "#85827b", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7 },
  errorBox: { marginHorizontal: 20, marginVertical: 8, borderRadius: 12, padding: 12, backgroundColor: "#fff0ee", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  errorText: { color: "#9f3832", fontSize: 12, lineHeight: 17, flex: 1 }, retry: { color: "#9f3832", fontWeight: "800", fontSize: 12 },
  pageBody: { padding: 20, paddingBottom: 36 }, detailTitle: { color: "#232220", fontSize: 26, lineHeight: 32, letterSpacing: -0.6, fontWeight: "700", marginBottom: 7 },
  detailBudget: { backgroundColor: "#efedff", alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 18, marginBottom: 22 }, detailBudgetText: { color: purple, fontWeight: "700", fontSize: 13 },
  sectionTitle: { color: "#33322e", fontSize: 17, fontWeight: "700", marginBottom: 11 }, detailDescription: { color: "#595750", fontSize: 15, lineHeight: 24, marginBottom: 24 },
  panel: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eeece7", borderRadius: 18, padding: 16, marginTop: 8, marginBottom: 18 },
  field: { marginBottom: 15 }, fieldLabel: { color: "#3b3935", fontSize: 12, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#e2e0da", backgroundColor: "#fff", paddingHorizontal: 13, color: "#282723", fontSize: 14 }, multiline: { minHeight: 110, paddingTop: 12 },
  proposalCard: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#eeece7" },
  secondaryButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#e1deda", alignItems: "center", justifyContent: "center", marginTop: 12 }, secondaryText: { color: "#5f5b55", fontSize: 13, fontWeight: "700" },
  smallButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: "#f0effa" }, smallButtonText: { color: purple, fontSize: 11, fontWeight: "700" },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 14 }, choice: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: "#e2e0da", alignItems: "center", justifyContent: "center" }, choiceSelected: { borderColor: purple, backgroundColor: "#f1efff" }, choiceText: { color: "#77756f", fontSize: 12, fontWeight: "600" }, choiceTextSelected: { color: purple, fontWeight: "800" },
  rowFields: { flexDirection: "row", gap: 10 },
  thread: { flex: 1 }, threadContent: { paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  messageBubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 }, myMessage: { alignSelf: "flex-end", backgroundColor: "#e9e5fc" }, theirMessage: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#eceae4" },
  messageBody: { color: "#302f2c", fontSize: 14, lineHeight: 20 }, messageTime: { color: "#918e87", fontSize: 9, marginTop: 5, alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 13, borderTopWidth: 1, borderColor: "#e9e7e1", backgroundColor: "#f8f7f4" },
  composerInput: { flex: 1, maxHeight: 100, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e0da", color: "#292824", fontSize: 14 },
  sendButton: { height: 43, paddingHorizontal: 15, borderRadius: 12, backgroundColor: purple, alignItems: "center", justifyContent: "center" }, sendButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

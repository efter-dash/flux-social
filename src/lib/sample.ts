/**
 * Sample workspace.
 *
 * Deliberately generic — a small in-house social team for an unnamed brand — so
 * it demonstrates the tool without implying it is built for any one company.
 * Every date is generated relative to today, so the demo always looks current:
 * some work is published, some is mid-pipeline, some is late, one thing is
 * blocked. That mix is what makes the dashboard and alerts worth looking at.
 */

import type {
  ContentItem,
  Idea,
  Member,
  PerformanceMetrics,
  StageState,
  TaskItem,
  WeeklyReview,
  Workspace,
  WorkspaceData,
  AuthUser,
} from './types'
import { addDays, monthKey, startOfWeek, today } from './date'
import { newWorkspace, newMember, uid, formatCode } from './factories'

interface SampleSpec {
  title: string
  topic: string
  type: string
  category: string
  platform: string
  crossPost?: string[]
  objective: string
  audience: string
  priority: string
  /** Offset in days from today for the planned publish date. */
  publishOffset: number
  /** How many pipeline stages are complete. */
  done: number
  /** Marks the stage after `done` as in progress. */
  working?: boolean
  blocker?: string
  nextAction?: string
  published?: boolean
  /** Days late when published (0 = on time). */
  lateBy?: number
  metrics?: Partial<PerformanceMetrics>
  ownerIdx: number
  writerIdx: number
  shooterIdx: number
  editorIdx: number
}

const SPECS: SampleSpec[] = [
  {
    title: 'Product launch teaser',
    topic: 'Spring release',
    type: 'Reel',
    category: 'Announcement',
    platform: 'Instagram',
    crossPost: ['Facebook'],
    objective: 'Brand awareness',
    audience: 'Existing customers',
    priority: 'High',
    publishOffset: -12,
    done: 4,
    published: true,
    lateBy: 0,
    metrics: { views: 24800, reach: 31200, likes: 1840, comments: 96, shares: 212, saves: 430, watchTimeMin: 9200, avgWatchTimeSec: 22, completionRate: 0.64, leads: 41, conversions: 9, response: 'Strong saves and shares', rating: 'Excellent', keyLearning: 'Teasers with a visible countdown outperform plain product shots.', repurposePotential: 'High' },
    ownerIdx: 1, writerIdx: 1, shooterIdx: 3, editorIdx: 4,
  },
  {
    title: 'Customer story: switching in a week',
    topic: 'Customer proof',
    type: 'Testimonial',
    category: 'Customer Story',
    platform: 'YouTube',
    objective: 'Conversions',
    audience: 'Evaluating buyers',
    priority: 'High',
    publishOffset: -9,
    done: 4,
    published: true,
    lateBy: 2,
    metrics: { views: 11400, reach: 13900, likes: 690, comments: 128, shares: 74, saves: 156, watchTimeMin: 7100, avgWatchTimeSec: 38, completionRate: 0.57, leads: 63, conversions: 21, response: 'Best lead volume this month', rating: 'Excellent', keyLearning: 'Named customers with a concrete timeframe convert far better than generic praise.', repurposePotential: 'High' },
    ownerIdx: 6, writerIdx: 1, shooterIdx: 3, editorIdx: 5,
  },
  {
    title: 'Five workflow shortcuts',
    topic: 'Tips series',
    type: 'Carousel',
    category: 'Educational',
    platform: 'LinkedIn',
    crossPost: ['X'],
    objective: 'Engagement',
    audience: 'Operations teams',
    priority: 'Medium',
    publishOffset: -6,
    done: 4,
    published: true,
    lateBy: 0,
    metrics: { views: 8200, reach: 9600, likes: 412, comments: 37, shares: 58, saves: 240, leads: 12, conversions: 3, response: 'Good comment thread', rating: 'Good', keyLearning: 'Numbered carousels hold attention to the last slide when each tip fits one line.', repurposePotential: 'Medium' },
    ownerIdx: 1, writerIdx: 1, shooterIdx: 2, editorIdx: 2,
  },
  {
    title: 'Behind the scenes: design review',
    topic: 'Culture',
    type: 'Short Video',
    category: 'Behind the Scenes',
    platform: 'Instagram',
    objective: 'Community building',
    audience: 'Followers and candidates',
    priority: 'Low',
    publishOffset: -3,
    done: 4,
    published: true,
    lateBy: 0,
    metrics: { views: 5100, reach: 6400, likes: 288, comments: 21, shares: 12, saves: 44, watchTimeMin: 1600, avgWatchTimeSec: 18, completionRate: 0.41, leads: 2, conversions: 0, response: 'Quiet but warm', rating: 'Average', keyLearning: 'Culture posts build goodwill but do not move signups; keep them cheap to make.', repurposePotential: 'Low' },
    ownerIdx: 6, writerIdx: 1, shooterIdx: 3, editorIdx: 4,
  },
  {
    title: 'Integration walkthrough',
    topic: 'Feature depth',
    type: 'Long Video',
    category: 'Educational',
    platform: 'YouTube',
    objective: 'Education',
    audience: 'Power users',
    priority: 'High',
    publishOffset: 1,
    done: 4,
    nextAction: 'Schedule and publish',
    ownerIdx: 1, writerIdx: 1, shooterIdx: 3, editorIdx: 5,
  },
  {
    title: 'Pricing update explainer',
    topic: 'Pricing change',
    type: 'Short Video',
    category: 'Announcement',
    platform: 'Instagram',
    crossPost: ['Facebook', 'Threads'],
    objective: 'Brand awareness',
    audience: 'All customers',
    priority: 'High',
    publishOffset: 3,
    done: 3,
    working: true,
    nextAction: 'Final legal read before review sign-off',
    ownerIdx: 6, writerIdx: 1, shooterIdx: 3, editorIdx: 4,
  },
  {
    title: 'Quarterly roundup thread',
    topic: 'Quarter recap',
    type: 'Static Post',
    category: 'Brand',
    platform: 'X',
    objective: 'Engagement',
    audience: 'Industry followers',
    priority: 'Medium',
    publishOffset: 5,
    done: 3,
    nextAction: 'Awaiting review from the lead',
    ownerIdx: 1, writerIdx: 1, shooterIdx: 2, editorIdx: 2,
  },
  {
    title: 'Founder Q&A',
    topic: 'Leadership voice',
    type: 'Live',
    category: 'Community',
    platform: 'Instagram',
    objective: 'Community building',
    audience: 'Engaged followers',
    priority: 'Medium',
    publishOffset: -2,
    done: 2,
    blocker: 'Waiting on the founder to confirm a recording slot',
    nextAction: 'Chase calendar hold for Thursday',
    ownerIdx: 6, writerIdx: 1, shooterIdx: 3, editorIdx: 5,
  },
  {
    title: 'Feature comparison carousel',
    topic: 'Competitive',
    type: 'Carousel',
    category: 'Product',
    platform: 'LinkedIn',
    objective: 'Lead generation',
    audience: 'Evaluating buyers',
    priority: 'High',
    publishOffset: -1,
    done: 2,
    working: true,
    nextAction: 'Finish slide 4 and hand to review',
    ownerIdx: 1, writerIdx: 1, shooterIdx: 2, editorIdx: 2,
  },
  {
    title: 'Onboarding tips series, part 1',
    topic: 'Activation',
    type: 'Reel',
    category: 'Educational',
    platform: 'TikTok',
    crossPost: ['Instagram'],
    objective: 'Retention',
    audience: 'New signups',
    priority: 'Medium',
    publishOffset: 7,
    done: 1,
    working: true,
    nextAction: 'Book the shoot for Tuesday morning',
    ownerIdx: 1, writerIdx: 1, shooterIdx: 3, editorIdx: 4,
  },
  {
    title: 'Community spotlight',
    topic: 'User generated',
    type: 'Story',
    category: 'Community',
    platform: 'Instagram',
    objective: 'Engagement',
    audience: 'Followers',
    priority: 'Low',
    publishOffset: 9,
    done: 1,
    nextAction: 'Collect three submissions to feature',
    ownerIdx: 6, writerIdx: 1, shooterIdx: 3, editorIdx: 4,
  },
  {
    title: 'Annual report highlights',
    topic: 'Company milestone',
    type: 'Carousel',
    category: 'Brand',
    platform: 'LinkedIn',
    objective: 'Brand awareness',
    audience: 'Industry and press',
    priority: 'Medium',
    publishOffset: 12,
    done: 0,
    working: true,
    nextAction: 'Pull the three headline numbers',
    ownerIdx: 1, writerIdx: 1, shooterIdx: 2, editorIdx: 2,
  },
  {
    title: 'Webinar promo',
    topic: 'Event',
    type: 'Short Video',
    category: 'Promotional',
    platform: 'Facebook',
    objective: 'Lead generation',
    audience: 'Mid-funnel prospects',
    priority: 'High',
    publishOffset: 16,
    done: 0,
    nextAction: 'Draft the script from the event brief',
    ownerIdx: 6, writerIdx: 1, shooterIdx: 3, editorIdx: 5,
  },
  {
    title: 'Year in review video',
    topic: 'Retrospective',
    type: 'Long Video',
    category: 'Brand',
    platform: 'YouTube',
    objective: 'Brand awareness',
    audience: 'All audiences',
    priority: 'Low',
    publishOffset: 34,
    done: 0,
    nextAction: 'Outline the narrative arc',
    ownerIdx: 1, writerIdx: 1, shooterIdx: 3, editorIdx: 5,
  },
]

const TEAMMATES: { name: string; role: string; responsibility: string }[] = [
  { name: 'Priya Raman', role: 'Content Writer', responsibility: 'Scripts, captions and the content calendar' },
  { name: 'Sam Okafor', role: 'Designer', responsibility: 'Carousels, static posts and thumbnails' },
  { name: 'Jonas Weber', role: 'Videographer', responsibility: 'All filming and raw footage handover' },
  { name: 'Mei Lin', role: 'Video Editor', responsibility: 'Short-form editing' },
  { name: 'Dana Brooks', role: 'Video Editor', responsibility: 'Long-form editing and sound' },
  { name: 'Tomas Silva', role: 'Social Manager', responsibility: 'Scheduling, community and performance reporting' },
]

const IDEA_SEEDS: { topic: string; description: string; type: string; category: string; platform: string; potential: string; priority: string; status: Idea['status']; reference: string }[] = [
  { topic: 'Myth-busting series', description: 'Short reels correcting the three misconceptions support hears every week.', type: 'Reel', category: 'Educational', platform: 'Instagram', potential: 'High', priority: 'High', status: 'approved', reference: 'Support ticket themes' },
  { topic: 'Day in the life', description: 'Follow one teammate through a working day, cut to 45 seconds.', type: 'Short Video', category: 'Behind the Scenes', platform: 'TikTok', potential: 'Medium', priority: 'Medium', status: 'approved', reference: 'Team suggestion' },
  { topic: 'Before and after teardown', description: 'Show a customer workflow before and after, side by side.', type: 'Carousel', category: 'Customer Story', platform: 'LinkedIn', potential: 'High', priority: 'High', status: 'reviewed', reference: 'Sales call recording' },
  { topic: 'Ask us anything', description: 'Monthly story sticker collecting questions, answered in a live.', type: 'Live', category: 'Community', platform: 'Instagram', potential: 'Medium', priority: 'Low', status: 'reviewed', reference: 'Community poll' },
  { topic: 'Template giveaway', description: 'Free template as a lead magnet, promoted across three platforms.', type: 'Static Post', category: 'Promotional', platform: 'LinkedIn', potential: 'High', priority: 'Medium', status: 'new', reference: 'Growth backlog' },
  { topic: 'Glossary shorts', description: 'One jargon term explained per week in under 20 seconds.', type: 'Reel', category: 'Educational', platform: 'TikTok', potential: 'Medium', priority: 'Low', status: 'new', reference: 'Search queries' },
  { topic: 'Partner takeover', description: 'Hand the account to a partner brand for a day.', type: 'Story', category: 'Community', platform: 'Instagram', potential: 'Low', priority: 'Low', status: 'new', reference: 'Partnerships' },
  { topic: 'Roadmap sneak peek', description: 'Tease two shipping features without committing to dates.', type: 'Carousel', category: 'Product', platform: 'X', potential: 'Medium', priority: 'Medium', status: 'rejected', reference: 'Product marketing' },
]

const TASK_TEMPLATES = ['Write script', 'Shoot footage', 'Edit cut', 'Review and sign off']

/**
 * Builds a full sample workspace owned by `user`.
 * The signed-in person becomes the Team Lead so the demo reflects their view.
 */
export function buildSampleWorkspace(user: AuthUser, name = 'Sample Workspace'): WorkspaceData {
  const workspace: Workspace = newWorkspace({
    name,
    templateId: 'video',
    createdBy: user.uid,
  })

  const lead = newMember({
    workspaceId: workspace.id,
    name: user.name,
    email: user.email,
    role: 'Team Lead',
    access: 'owner',
    userId: user.uid,
    responsibility: 'Overall content operations',
  })

  const members: Member[] = [
    lead,
    ...TEAMMATES.map((t) =>
      newMember({
        workspaceId: workspace.id,
        name: t.name,
        email: `${t.name.split(' ')[0].toLowerCase()}@example.com`,
        role: t.role,
        access: t.role === 'Social Manager' ? 'admin' : 'member',
        responsibility: t.responsibility,
      }),
    ),
  ]

  const stages = workspace.stages
  const now = today()
  const content: ContentItem[] = []
  const tasks: TaskItem[] = []
  let taskSeq = 0

  SPECS.forEach((spec, i) => {
    const code = formatCode(workspace.contentPrefix, i + 1, 4)
    const planned = addDays(now, spec.publishOffset)
    const stageStates: Record<string, StageState> = {}
    const stageAssignees: Record<string, string> = {}
    const stageDeadlines: Record<string, string> = {}
    const stageEnteredAt: Record<string, string> = {}

    // Stage deadlines walk backwards from the publish date, one per stage.
    const gap = 2
    stages.forEach((stage, idx) => {
      const leadDays = (stages.length - idx) * gap
      stageDeadlines[stage.id] = addDays(planned, -leadDays)
      stageStates[stage.id] = idx < spec.done ? 'complete' : idx === spec.done && spec.working ? 'in_progress' : 'pending'
      const assigneeIdx = [spec.writerIdx, spec.shooterIdx, spec.editorIdx, 0][Math.min(idx, 3)]
      stageAssignees[stage.id] = members[assigneeIdx]?.id ?? members[0].id
      if (idx <= spec.done) stageEnteredAt[stage.id] = addDays(planned, -leadDays - 1)
    })

    // Blocked work should register as blocked on the stage too, not just in a note.
    if (spec.blocker && stages[spec.done]) stageStates[stages[spec.done].id] = 'blocked'

    const publishedOn = spec.published ? addDays(planned, spec.lateBy ?? 0) : ''
    const nowISO = new Date().toISOString()

    const item: ContentItem = {
      id: uid('cn_'),
      workspaceId: workspace.id,
      code,
      month: monthKey(planned),
      title: spec.title,
      topic: spec.topic,
      contentType: spec.type,
      category: spec.category,
      platform: spec.platform,
      crossPost: spec.crossPost ?? [],
      objective: spec.objective,
      audience: spec.audience,
      ownerId: members[spec.ownerIdx]?.id ?? members[0].id,
      stageAssignees,
      stageDeadlines,
      stageStates,
      stageEnteredAt,
      plannedPublishDate: planned,
      actualPublishDate: publishedOn,
      priority: spec.priority,
      lifecycle: spec.published ? 'published' : spec.done === 0 && !spec.working ? 'idea' : 'active',
      blocker: spec.blocker ?? '',
      nextAction: spec.nextAction ?? '',
      caption: '',
      hashtags: '',
      links: {
        brief: spec.done >= 1 ? 'https://example.com/brief' : '',
        raw: spec.done >= 2 ? 'https://example.com/footage' : '',
        final: spec.done >= 3 ? 'https://example.com/final-cut' : '',
        published: spec.published ? 'https://example.com/post' : '',
      },
      remarks: '',
      performance: spec.metrics ? { ...EMPTY, ...spec.metrics } : null,
      createdAt: nowISO,
      updatedAt: nowISO,
      updatedBy: user.uid,
    }
    content.push(item)

    // One task per stage: completed for finished stages, open for the current one.
    stages.forEach((stage, idx) => {
      if (idx > spec.done) return
      taskSeq++
      const complete = idx < spec.done
      const deadline = stageDeadlines[stage.id]
      const blocked = Boolean(spec.blocker) && idx === spec.done
      tasks.push({
        id: uid('tk_'),
        workspaceId: workspace.id,
        code: formatCode(workspace.taskPrefix, taskSeq, 4),
        date: addDays(deadline, -1),
        memberId: stageAssignees[stage.id],
        title: `${TASK_TEMPLATES[Math.min(idx, TASK_TEMPLATES.length - 1)]} — ${spec.title}`,
        contentId: item.id,
        stageId: stage.id,
        taskType: ['Script Writing', 'Shooting', 'Video Editing', 'Content Planning'][Math.min(idx, 3)],
        priority: spec.priority,
        deadline,
        status: complete ? 'completed' : blocked ? 'blocked' : spec.working ? 'working' : 'not_started',
        completionDate: complete ? deadline : '',
        outputLink: complete ? 'https://example.com/output' : '',
        remarks: blocked ? spec.blocker ?? '' : '',
        createdAt: nowISO,
        updatedAt: nowISO,
      })
    })

    // Publishing task for anything already live.
    if (spec.published) {
      taskSeq++
      tasks.push({
        id: uid('tk_'),
        workspaceId: workspace.id,
        code: formatCode(workspace.taskPrefix, taskSeq, 4),
        date: publishedOn,
        memberId: members[6]?.id ?? members[0].id,
        title: `Publish — ${spec.title}`,
        contentId: item.id,
        stageId: '',
        taskType: 'Publishing',
        priority: spec.priority,
        deadline: planned,
        status: 'completed',
        completionDate: publishedOn,
        outputLink: 'https://example.com/post',
        remarks: '',
        createdAt: nowISO,
        updatedAt: nowISO,
      })
    }
  })

  const ideas: Idea[] = IDEA_SEEDS.map((seed, i) => ({
    id: uid('id_'),
    workspaceId: workspace.id,
    code: formatCode(workspace.ideaPrefix, i + 1, 3),
    dateAdded: addDays(now, -30 + i * 3),
    topic: seed.topic,
    description: seed.description,
    contentType: seed.type,
    category: seed.category,
    platform: seed.platform,
    audience: '',
    objective: '',
    reference: seed.reference,
    priority: seed.priority,
    potential: seed.potential,
    status: seed.status,
    contentId: '',
    submittedBy: members[(i % (members.length - 1)) + 1].id,
    remarks: '',
    createdAt: new Date().toISOString(),
  }))

  const thisWeek = startOfWeek(now, workspace.weekStartsOn)
  const reviews: WeeklyReview[] = [-2, -1, 0].map((offset, idx) => {
    const start = addDays(thisWeek, offset * 7)
    return {
      id: uid('wr_'),
      workspaceId: workspace.id,
      weekStart: start,
      weekEnd: addDays(start, 6),
      label: `Week of ${start}`,
      planned: idx === 2 ? '' : 'Four items planned across three platforms.',
      completed: idx === 2 ? '' : 'Three published, one slipped to the following week.',
      delayed: idx === 2 ? '' : 'Long-form video held up in editing.',
      performedWell: idx === 2 ? '' : 'Customer story drove the best lead volume of the month.',
      needsAttention: idx === 2 ? '' : 'Footage handover keeps stalling the edit queue.',
      keyWins: idx === 2 ? '' : 'Testimonial format validated.',
      keyProblems: idx === 2 ? '' : 'Editing is the persistent bottleneck.',
      nextPriorities: idx === 2 ? '' : 'Lock the shoot schedule a week ahead.',
      actionOwnerId: idx === 2 ? '' : members[6]?.id ?? '',
      actionDeadline: idx === 2 ? '' : addDays(start, 9),
      status: idx === 2 ? 'not_started' : idx === 1 ? 'open' : 'done',
      updatedAt: new Date().toISOString(),
    }
  })

  workspace.counters = { content: SPECS.length, task: taskSeq, idea: IDEA_SEEDS.length }

  return { workspace, members, content, tasks, ideas, reviews }
}

const EMPTY: PerformanceMetrics = {
  views: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  watchTimeMin: null,
  avgWatchTimeSec: null,
  completionRate: null,
  leads: null,
  conversions: null,
  response: '',
  rating: '',
  keyLearning: '',
  repurposePotential: '',
  remarks: '',
}

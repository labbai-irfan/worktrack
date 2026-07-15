import { Task } from '../models/Task';
import { Milestone } from '../models/Milestone';
import { Activity } from '../models/Activity';
import type { PROJECT_HEALTH } from '../constants/enums';

export interface ProjectHealthMetrics {
  openTasks: number;
  overdueTasks: number;
  overdueRatio: number;
  blockedTasks: number;
  blockedCriticalTasks: number;
  overdueMilestones: number;
  upcomingMilestones: number;
  daysSinceActivity: number | null;
}

export interface ProjectHealthResult {
  health: (typeof PROJECT_HEALTH)[number];
  reasons: string[];
  metrics: ProjectHealthMetrics;
  recommendedAction: string;
}

/**
 * Transparent, rule-based project health score. Every verdict carries the
 * metrics and reasons that produced it — never an unexplained red/green dot.
 * Rules are evaluated most-severe-first so `reasons` always explains the
 * actual verdict, not a lesser one.
 */
export async function computeProjectHealth(
  scope: { organizationId: unknown },
  projectId: unknown,
  projectStatus: string
): Promise<ProjectHealthResult> {
  const now = new Date();

  const [openTasks, overdueTasks, blockedTasks, blockedCriticalTasks, overdueMilestones, upcomingMilestones, lastActivity] =
    await Promise.all([
      Task.countDocuments({ ...scope, projectId, status: { $nin: ['completed', 'cancelled'] }, deletedAt: null }),
      Task.countDocuments({ ...scope, projectId, status: { $nin: ['completed', 'cancelled'] }, dueDate: { $lt: now, $ne: null }, deletedAt: null }),
      Task.countDocuments({ ...scope, projectId, status: 'blocked', deletedAt: null }),
      Task.countDocuments({ ...scope, projectId, status: 'blocked', priority: { $in: ['urgent', 'high'] }, deletedAt: null }),
      Milestone.countDocuments({ ...scope, projectId, status: { $nin: ['completed'] }, dueDate: { $lt: now, $ne: null } }),
      Milestone.countDocuments({ ...scope, projectId, status: { $nin: ['completed'] }, dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 86_400_000) } }),
      Activity.findOne({ ...scope, projectId }).sort({ createdAt: -1 }).select('createdAt').lean(),
    ]);

  const overdueRatio = openTasks > 0 ? overdueTasks / openTasks : 0;
  const daysSinceActivity = lastActivity ? Math.max(0, Math.floor((now.getTime() - new Date(lastActivity.createdAt).getTime()) / 86_400_000)) : null;

  const metrics: ProjectHealthMetrics = {
    openTasks, overdueTasks, overdueRatio, blockedTasks, blockedCriticalTasks,
    overdueMilestones, upcomingMilestones, daysSinceActivity,
  };

  const reasons: string[] = [];
  let health: ProjectHealthResult['health'] = 'healthy';
  let recommendedAction = 'No action needed — project is on track.';

  const isStale = daysSinceActivity !== null && daysSinceActivity >= 14 && projectStatus === 'active';
  const isSevereOverdue = overdueRatio > 0.5 && openTasks >= 4;

  if ((overdueMilestones > 0 && blockedCriticalTasks > 0) || isStale || isSevereOverdue) {
    health = 'critical';
    if (overdueMilestones > 0 && blockedCriticalTasks > 0) {
      reasons.push(`${overdueMilestones} milestone(s) overdue while ${blockedCriticalTasks} high-priority task(s) are blocked.`);
    }
    if (isStale) reasons.push(`No recorded activity in ${daysSinceActivity} days on an active project.`);
    if (isSevereOverdue) reasons.push(`${Math.round(overdueRatio * 100)}% of open tasks (${overdueTasks}/${openTasks}) are overdue.`);
    recommendedAction = 'Escalate immediately — resolve blockers and re-baseline the schedule with the project manager.';
  } else if (overdueMilestones > 0 || blockedCriticalTasks >= 2 || (overdueRatio > 0.25 && openTasks >= 4)) {
    health = 'at_risk';
    if (overdueMilestones > 0) reasons.push(`${overdueMilestones} milestone(s) are past their due date.`);
    if (blockedCriticalTasks >= 2) reasons.push(`${blockedCriticalTasks} high-priority tasks are blocked.`);
    if (overdueRatio > 0.25 && openTasks >= 4) reasons.push(`${Math.round(overdueRatio * 100)}% of open tasks are overdue.`);
    recommendedAction = 'Review blocked and overdue tasks this week; consider reassigning or extending the timeline.';
  } else if (blockedTasks >= 1 || overdueRatio > 0.1 || (daysSinceActivity !== null && daysSinceActivity >= 7)) {
    health = 'attention';
    if (blockedTasks >= 1) reasons.push(`${blockedTasks} task(s) are currently blocked.`);
    if (overdueRatio > 0.1) reasons.push(`${overdueTasks} of ${openTasks} open tasks are overdue.`);
    if (daysSinceActivity !== null && daysSinceActivity >= 7) reasons.push(`No activity recorded in ${daysSinceActivity} days.`);
    recommendedAction = 'Check in with the team on blockers and upcoming due dates.';
  } else {
    reasons.push('No overdue milestones, low overdue-task ratio, no unresolved critical blockers.');
  }

  if (upcomingMilestones > 0) {
    reasons.push(`${upcomingMilestones} milestone(s) due within 7 days.`);
  }

  return { health, reasons, metrics, recommendedAction };
}

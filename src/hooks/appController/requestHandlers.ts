import type { Dispatch, SetStateAction } from 'react';
import type { I18nKey } from '../../../i18n';
import type { PermissionReply, PermissionRequest, QuestionRequest } from '../../types/chat';
import { buildApiUrl } from '../../utils/chatApi';
import { fetchWithTrace } from '../useAppController.helpers';

type PendingPermissionSetter = Dispatch<SetStateAction<PermissionRequest[]>>;
type PendingQuestionSetter = Dispatch<SetStateAction<QuestionRequest[]>>;

type PermissionReplyParams = {
  gatewayBaseUrl: string;
  activeDirectory: string;
  requestId: string;
  reply: PermissionReply;
  message?: string;
  setPendingPermissions: PendingPermissionSetter;
  t: (key: I18nKey) => string;
};

export async function replyPermissionRequest({
  gatewayBaseUrl,
  activeDirectory,
  requestId,
  reply,
  message,
  setPendingPermissions,
  t,
}: PermissionReplyParams): Promise<boolean> {
  if (!gatewayBaseUrl) return false;

  setPendingPermissions((prev) =>
    prev.map((item) =>
      item.id === requestId
        ? {
            ...item,
            status: 'submitting',
            error: '',
          }
        : item,
    ),
  );

  const body: Record<string, string> = {
    reply,
  };
  const trimmedMessage = message?.trim() ?? '';
  if (reply === 'reject' && trimmedMessage) {
    body.message = trimmedMessage;
  }

  try {
    const response = await fetchWithTrace(
      'permission-reply',
      buildApiUrl(gatewayBaseUrl, `/permission/${requestId}/reply`, { directory: activeDirectory }),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error('permission-reply-failed');
    }

    setPendingPermissions((prev) => prev.filter((item) => item.id !== requestId));
    return true;
  } catch {
    setPendingPermissions((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: 'error',
              error: t('permissionReplyFailed'),
            }
          : item,
      ),
    );
    return false;
  }
}

type QuestionReplyParams = {
  gatewayBaseUrl: string;
  activeDirectory: string;
  requestId: string;
  answers: string[][];
  setPendingQuestions: PendingQuestionSetter;
  t: (key: I18nKey) => string;
};

export async function replyQuestionRequest({
  gatewayBaseUrl,
  activeDirectory,
  requestId,
  answers,
  setPendingQuestions,
  t,
}: QuestionReplyParams): Promise<boolean> {
  if (!gatewayBaseUrl) return false;

  setPendingQuestions((prev) =>
    prev.map((item) =>
      item.id === requestId
        ? {
            ...item,
            status: 'submitting',
            error: '',
          }
        : item,
    ),
  );

  try {
    const response = await fetchWithTrace(
      'question-reply',
      buildApiUrl(gatewayBaseUrl, `/question/${requestId}/reply`, { directory: activeDirectory }),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      },
    );

    if (!response.ok) {
      throw new Error('question-reply-failed');
    }

    setPendingQuestions((prev) => prev.filter((item) => item.id !== requestId));
    return true;
  } catch {
    setPendingQuestions((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: 'error',
              error: t('questionReplyFailed'),
            }
          : item,
      ),
    );
    return false;
  }
}

type QuestionRejectParams = {
  gatewayBaseUrl: string;
  activeDirectory: string;
  requestId: string;
  setPendingQuestions: PendingQuestionSetter;
  t: (key: I18nKey) => string;
};

export async function rejectQuestionRequest({
  gatewayBaseUrl,
  activeDirectory,
  requestId,
  setPendingQuestions,
  t,
}: QuestionRejectParams): Promise<boolean> {
  if (!gatewayBaseUrl) return false;

  setPendingQuestions((prev) =>
    prev.map((item) =>
      item.id === requestId
        ? {
            ...item,
            status: 'submitting',
            error: '',
          }
        : item,
    ),
  );

  try {
    const response = await fetchWithTrace(
      'question-reject',
      buildApiUrl(gatewayBaseUrl, `/question/${requestId}/reject`, { directory: activeDirectory }),
      {
        method: 'POST',
      },
    );

    if (!response.ok) {
      throw new Error('question-reject-failed');
    }

    setPendingQuestions((prev) => prev.filter((item) => item.id !== requestId));
    return true;
  } catch {
    setPendingQuestions((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: 'error',
              error: t('questionRejectFailed'),
            }
          : item,
      ),
    );
    return false;
  }
}

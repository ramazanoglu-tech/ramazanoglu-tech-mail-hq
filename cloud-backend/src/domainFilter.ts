// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - STRICT DOMAIN FILTER (KATI DOMAIN İZOLASYONU)
// =============================================================================

import { config } from './config.js';
import { getAliases } from './db.js';

export interface FilterResult {
  matchesDomain: boolean;
  matchedAlias: string;
  matchedHeader: string;
  reason?: string;
}

/**
 * Extracts all email addresses found in a header value or array of values.
 */
function extractEmailAddresses(val: unknown): string[] {
  if (!val) return [];
  const results: string[] = [];

  const addFromStr = (s: string) => {
    // Matches email addresses inside <...> or raw
    const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = s.match(regex);
    if (matches) {
      for (const m of matches) {
        results.push(m.toLowerCase().trim());
      }
    }
  };

  if (typeof val === 'string') {
    addFromStr(val);
  } else if (Array.isArray(val)) {
    for (const item of val) {
      if (typeof item === 'string') {
        addFromStr(item);
      } else if (item && typeof item === 'object') {
        if ('address' in item && typeof item.address === 'string') {
          results.push(item.address.toLowerCase().trim());
        } else if ('text' in item && typeof item.text === 'string') {
          addFromStr(item.text);
        } else if ('value' in item && Array.isArray(item.value)) {
          for (const v of item.value) {
            if (v && v.address) results.push(v.address.toLowerCase().trim());
          }
        }
      }
    }
  } else if (typeof val === 'object' && val !== null) {
    if ('value' in val && Array.isArray((val as Record<string, unknown>).value)) {
      for (const v of (val as { value: { address?: string }[] }).value) {
        if (v && v.address) results.push(v.address.toLowerCase().trim());
      }
    }
  }

  return Array.from(new Set(results));
}

/**
 * Evaluates whether an email belongs strictly to @ramazanoglu.tech.
 * If neither To, Cc, Bcc, Delivered-To, nor From contain @ramazanoglu.tech,
 * the email is rejected with 0 database write and 0 client broadcast.
 */
export async function evaluateStrictDomainFilter(headers: Record<string, unknown>): Promise<FilterResult> {
  const targetDomain = config.domainFilter; // '@ramazanoglu.tech'
  const knownAliases = await getAliases();
  const knownAliasEmails = new Set(knownAliases.map((a) => a.email.toLowerCase()));

  // Headers to inspect strictly
  const headerKeys = [
    { key: 'to', weight: 1 },
    { key: 'delivered-to', weight: 2 },
    { key: 'x-original-to', weight: 3 },
    { key: 'x-forwarded-to', weight: 4 },
    { key: 'x-ramazanoglu-identity', weight: 5 },
    { key: 'x-google-original-from', weight: 6 },
    { key: 'reply-to', weight: 7 },
    { key: 'from', weight: 8 },
    { key: 'cc', weight: 9 },
    { key: 'bcc', weight: 10 },
    { key: 'message-id', weight: 11 },
    { key: 'return-path', weight: 12 },
  ];

  let matchedAddress: string | null = null;
  let matchedHeaderName = '';

  // 1. First priority: look for recipient headers containing @ramazanoglu.tech
  for (const { key } of headerKeys) {
    const rawVal = headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()];
    const addresses = extractEmailAddresses(rawVal);

    for (const addr of addresses) {
      if (addr.endsWith(targetDomain)) {
        // If it matches a known alias, prioritize immediately
        if (knownAliasEmails.has(addr)) {
          return {
            matchesDomain: true,
            matchedAlias: addr,
            matchedHeader: key,
          };
        }
        // Otherwise store as candidate
        if (!matchedAddress) {
          matchedAddress = addr;
          matchedHeaderName = key;
        }
      }
    }
  }

  if (matchedAddress) {
    return {
      matchesDomain: true,
      matchedAlias: matchedAddress,
      matchedHeader: matchedHeaderName,
    };
  }

  return {
    matchesDomain: false,
    matchedAlias: '',
    matchedHeader: '',
    reason: `Strict Domain Filter Rejected: None of the message headers contained '${targetDomain}'. Personal or non-corporate mail discarded.`,
  };
}

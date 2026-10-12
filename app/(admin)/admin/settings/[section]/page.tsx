import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMerchant } from "@/lib/auth/merchant";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { InviteForm, PayoutForm, PlanCards, StoreForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { slug: "store", label: "Store" },
  { slug: "team", label: "Team" },
  { slug: "billing", label: "Billing" },
  { slug: "payouts", label: "Payouts" },
] as const;

type Section = (typeof SECTIONS)[number]["slug"];

function isSection(value: string): value is Section {
  return SECTIONS.some((section) => section.slug === value);
}

export default async function SettingsPage({ params }: PageProps<"/admin/settings/[section]">) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const { store, user } = await requireMerchant(`/admin/settings/${section}`);
  const isOwner = user.role === "owner";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-8 md:grid-cols-[180px_1fr]">
        <nav className="flex flex-row gap-1 md:flex-col" aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <Link
              key={item.slug}
              href={`/admin/settings/${item.slug}`}
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                item.slug === section
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:bg-accent/60",
              )}
              aria-current={item.slug === section ? "page" : undefined}
              data-testid={`settings-nav-${item.slug}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div>
          {section === "store" ? <StoreForm store={store} /> : null}
          {section === "team" ? <TeamSection storeId={store.id} canInvite={isOwner} /> : null}
          {section === "billing" ? (
            <>
              {store.plan === "starter" && store.trialEndsAt ? (
                <p className="mb-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-900">
                  Your trial ends {new Date(store.trialEndsAt).toLocaleDateString("en-US")}. Pick a
                  plan to keep selling.
                </p>
              ) : null}
              <PlanCards currentPlan={store.plan} canChange={isOwner} />
            </>
          ) : null}
          {section === "payouts" ? (
            <PayoutForm last4={store.payoutAccountLast4} canEdit={isOwner} />
          ) : null}
        </div>
      </div>
    </>
  );
}

async function TeamSection({ storeId, canInvite }: { storeId: string; canInvite: boolean }) {
  const [members, invites] = await Promise.all([
    db.users.listByStore(storeId),
    db.invites.listByStore(storeId),
  ]);
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-medium">Team members</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
                <TableCell>{new Date(member.lastSignInAt).toLocaleDateString("en-US")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section>
        <h2 className="mb-3 font-medium">Invite someone</h2>
        <InviteForm canInvite={canInvite} />
        {invites.length ? (
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            {invites.map((invite) => (
              <li key={invite.id}>
                {invite.email} · {invite.role} · invited{" "}
                {new Date(invite.sentAt).toLocaleDateString("en-US")}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { siteSchema, icons, photos, type SiteContent } from "@/lib/contracts";
import { api, Field, Notice, type State } from "./Workspace";
import { ConfirmDialog } from "./documents";
import { mayLeave, useUnsavedChanges } from "@/lib/unsaved";
import { workspaceLocation } from "@/lib/workspace-navigation";
export default function ContentEditor({
  initial,
  publications,
  connected,
  refresh,
}: {
  initial: { content: SiteContent; version: number };
  publications: State["publications"];
  connected: boolean;
  refresh: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial.content),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [section, setSection] = useState(() => {
      const requested =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(location.search).get("editor");
      return requested &&
        [
          "company",
          "services",
          "commitments",
          "socials",
          "publishing",
        ].includes(requested)
        ? requested
        : "company";
    }),
    [confirm, setConfirm] = useState(false),
    [preview, setPreview] = useState(false);
  useEffect(() => {
    setValue(initial.content);
    setDirty(false);
  }, [initial]);
  useUnsavedChanges(dirty);
  const update = (next: SiteContent) => {
    setValue(next);
    setDirty(true);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = siteSchema.safeParse(value);
      if (!result.success) {
        const issue = result.error.issues[0];
        throw new Error(
          `Review ${issue.path.join(" · ").replaceAll("_", " ") || "the website content"}: ${issue.message}`,
        );
      }
      await api("content/save", {
        version: initial.version,
        payload: result.data,
      });
      await refresh();
      setMessage("Website draft saved. The live website has not changed.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      await api("content/publish", { version: initial.version });
      setConfirm(false);
      await refresh();
      setMessage(
        "Build requested. Check publication status after Vercel finishes deploying.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkLive(revision: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ live: boolean }>("content/check-live", {
        revision,
      });
      await refresh();
      setMessage(
        result.live
          ? "This version is live on luteratech.com."
          : "This version is not live yet. Check the public website’s Vercel build logs if it continues.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel toolbar">
        <div>
          <h2>Website cPanel</h2>
          <p>
            Draft version {initial.version}. Review public information, save,
            then publish.
          </p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => setPreview(!preview)}>
            {preview ? "Close preview" : "Preview content"}
          </button>
          <button
            disabled={busy || dirty || !connected}
            onClick={() => setConfirm(true)}
          >
            Publish website ↗
          </button>
        </div>
      </section>
      {!connected && (
        <Notice>
          Draft editing is ready. Live publishing still needs the public
          website’s deploy hook and published-content build settings.
        </Notice>
      )}
      {preview && (
        <section className="panel content-preview">
          <img
            src="/brand/lutera-horizontal-light.svg"
            width="140"
            height="40"
            alt="Lutera"
          />
          <h2>{value.company.name}</h2>
          <p>{value.company.nature_of_business}</p>
          <p>
            {value.company.email} · {value.company.display_phone}
          </p>
          <p>
            {value.company.street_address}, {value.company.city},{" "}
            {value.company.state}
          </p>
          <div className="preview-services">
            {value.services.map((s) => (
              <article key={s.key}>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="panel subnav" role="group" aria-label="Website tools">
        {Object.entries({
          company: "Company & contact",
          services: "Services",
          commitments: "Service commitments",
          socials: "Social links",
          publishing: "Preview & publishing",
        }).map(([name, label]) => (
          <button
            key={name}
            type="button"
            className={section === name ? "" : "secondary"}
            onClick={() => {
              if (!mayLeave()) return;
              setSection(name);
              workspaceLocation({ editor: name });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {section !== "publishing" && (
        <form className="panel" onSubmit={save}>
          <fieldset disabled={busy}>
            <legend className="sr-only">Public website content</legend>
            {section === "company" && (
              <>
                <h3>Company & contact details</h3>
                <div className="form-grid">
                  {Object.entries(value.company)
                    .filter(([, v]) => typeof v === "string")
                    .map(([key, field]) => (
                      <Field
                        key={key}
                        label={
                          (
                            {
                              name: "Company display name",
                              legal_name: "Registered company name",
                              email: "General enquiry email",
                              support_email: "Support email",
                              phone: "Office phone (international format)",
                              display_phone: "Phone as displayed",
                              whatsapp: "WhatsApp link",
                              nature_of_business: "Business activities",
                              street_address: "Street address",
                              registration_number: "Registration number",
                              brand_name: "Brand name",
                            } as Record<string, string>
                          )[key] || key.replaceAll("_", " ")
                        }
                      >
                        {key === "nature_of_business" ? (
                          <textarea
                            rows={5}
                            maxLength={4000}
                            value={String(field)}
                            onChange={(e) =>
                              update({
                                ...value,
                                company: {
                                  ...value.company,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          <input
                            value={String(field)}
                            maxLength={key === "street_address" ? 250 : 254}
                            onChange={(e) =>
                              update({
                                ...value,
                                company: {
                                  ...value.company,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        )}
                      </Field>
                    ))}
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={value.company.registration_completed}
                    onChange={(e) =>
                      update({
                        ...value,
                        company: {
                          ...value.company,
                          registration_completed: e.target.checked,
                        },
                      })
                    }
                  />
                  Company registration completed
                </label>
                <p className="muted">
                  Leave the registration number blank until it is approved for
                  publication.
                </p>
              </>
            )}
            {section === "services" && (
              <>
                <h3>Company services</h3>
                <p>
                  Add, edit or remove services. Use plain text; links, titles
                  and page output are escaped and validated during the public
                  build.
                </p>
                {value.services.map((service, index) => (
                  <details className="service-edit" key={index}>
                    <summary>
                      {index + 1}. {service.title}
                    </summary>
                    <div className="form-grid">
                      {(
                        ["title", "key", "slug", "description", "alt"] as const
                      ).map((key) => (
                        <Field
                          key={key}
                          label={key === "alt" ? "Image description" : key}
                        >
                          {key === "description" ? (
                            <textarea
                              value={service[key]}
                              maxLength={800}
                              rows={3}
                              onChange={(e) =>
                                update({
                                  ...value,
                                  services: value.services.map((s, i) =>
                                    i === index
                                      ? { ...s, [key]: e.target.value }
                                      : s,
                                  ),
                                })
                              }
                            />
                          ) : (
                            <input
                              required
                              value={service[key]}
                              maxLength={key === "alt" ? 220 : 120}
                              onChange={(e) =>
                                update({
                                  ...value,
                                  services: value.services.map((s, i) =>
                                    i === index
                                      ? { ...s, [key]: e.target.value }
                                      : s,
                                  ),
                                })
                              }
                            />
                          )}
                        </Field>
                      ))}
                      <Field label="Image">
                        <select
                          value={service.image}
                          onChange={(e) =>
                            update({
                              ...value,
                              services: value.services.map((s, i) =>
                                i === index
                                  ? {
                                      ...s,
                                      image: e.target
                                        .value as typeof service.image,
                                    }
                                  : s,
                              ),
                            })
                          }
                        >
                          {photos.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Icon">
                        <select
                          value={service.icon}
                          onChange={(e) =>
                            update({
                              ...value,
                              services: value.services.map((s, i) =>
                                i === index
                                  ? {
                                      ...s,
                                      icon: e.target
                                        .value as typeof service.icon,
                                    }
                                  : s,
                              ),
                            })
                          }
                        >
                          {icons.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={Boolean(service.detail)}
                        onChange={(e) =>
                          update({
                            ...value,
                            services: value.services.map((s, i) =>
                              i === index
                                ? {
                                    ...s,
                                    detail: e.target.checked
                                      ? {
                                          heading: s.title,
                                          body: s.description,
                                          points: [
                                            "Discuss your requirements with Lutera.",
                                          ],
                                        }
                                      : undefined,
                                  }
                                : s,
                            ),
                          })
                        }
                      />
                      Custom service page content
                    </label>
                    {service.detail && (
                      <>
                        <Field label="Page heading">
                          <input
                            value={service.detail.heading}
                            maxLength={160}
                            onChange={(e) =>
                              update({
                                ...value,
                                services: value.services.map((s, i) =>
                                  i === index
                                    ? {
                                        ...s,
                                        detail: {
                                          ...s.detail!,
                                          heading: e.target.value,
                                        },
                                      }
                                    : s,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="Service page body">
                          <textarea
                            value={service.detail.body}
                            maxLength={5000}
                            rows={5}
                            onChange={(e) =>
                              update({
                                ...value,
                                services: value.services.map((s, i) =>
                                  i === index
                                    ? {
                                        ...s,
                                        detail: {
                                          ...s.detail!,
                                          body: e.target.value,
                                        },
                                      }
                                    : s,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="Service points (one per line)">
                          <textarea
                            value={service.detail.points.join("\n")}
                            rows={4}
                            onChange={(e) =>
                              update({
                                ...value,
                                services: value.services.map((s, i) =>
                                  i === index
                                    ? {
                                        ...s,
                                        detail: {
                                          ...s.detail!,
                                          points: e.target.value.split("\n"),
                                        },
                                      }
                                    : s,
                                ),
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    <button
                      type="button"
                      className="secondary danger"
                      disabled={value.services.length === 1}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${service.title} from the draft?`,
                          )
                        )
                          update({
                            ...value,
                            services: value.services.filter(
                              (_, i) => i !== index,
                            ),
                          });
                      }}
                    >
                      Remove service
                    </button>
                  </details>
                ))}
                <button
                  type="button"
                  className="secondary"
                  disabled={value.services.length >= 30}
                  onClick={() => {
                    const key = `service-${Date.now().toString(36)}`;
                    update({
                      ...value,
                      services: [
                        ...value.services,
                        {
                          key,
                          slug: key,
                          title: "New service",
                          icon: "software",
                          image: "software",
                          alt: "Software development computer",
                          description: "Describe this service.",
                        },
                      ],
                    });
                  }}
                >
                  Add service +
                </button>
                <p className="muted">
                  Changing an existing slug changes its address. Keep current
                  slugs when possible; removed service addresses return 404.
                </p>
              </>
            )}
            {section === "commitments" && (
              <>
                <h3>Public commitments</h3>
                {value.commitments.map((item, index) => (
                  <div className="service-edit" key={index}>
                    <Field label="Title">
                      <input
                        required
                        maxLength={140}
                        value={item.title}
                        onChange={(e) =>
                          update({
                            ...value,
                            commitments: value.commitments.map((c, i) =>
                              i === index ? { ...c, title: e.target.value } : c,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        required
                        maxLength={800}
                        rows={3}
                        value={item.description}
                        onChange={(e) =>
                          update({
                            ...value,
                            commitments: value.commitments.map((c, i) =>
                              i === index
                                ? { ...c, description: e.target.value }
                                : c,
                            ),
                          })
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      className="secondary danger"
                      disabled={value.commitments.length === 1}
                      onClick={() =>
                        update({
                          ...value,
                          commitments: value.commitments.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Remove commitment
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  disabled={value.commitments.length >= 8}
                  onClick={() =>
                    update({
                      ...value,
                      commitments: [
                        ...value.commitments,
                        {
                          title: "New commitment",
                          description:
                            "Describe only a promise the company can fulfil.",
                        },
                      ],
                    })
                  }
                >
                  Add commitment +
                </button>
              </>
            )}
            {section === "socials" && (
              <>
                <h3>Social media links</h3>
                <p>
                  Only HTTPS links are accepted. Empty lists show no social
                  links on the public website.
                </p>
                {(value.socials || []).map((social, index) => (
                  <div className="form-grid service-edit" key={index}>
                    <Field label="Platform / label">
                      <input
                        value={social.label}
                        maxLength={40}
                        required
                        onChange={(e) =>
                          update({
                            ...value,
                            socials: value.socials!.map((s, i) =>
                              i === index ? { ...s, label: e.target.value } : s,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Profile URL">
                      <input
                        type="url"
                        required
                        value={social.url}
                        maxLength={300}
                        onChange={(e) =>
                          update({
                            ...value,
                            socials: value.socials!.map((s, i) =>
                              i === index ? { ...s, url: e.target.value } : s,
                            ),
                          })
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      className="secondary danger"
                      onClick={() =>
                        update({
                          ...value,
                          socials: value.socials!.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove link
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  disabled={(value.socials || []).length >= 8}
                  onClick={() =>
                    update({
                      ...value,
                      socials: [
                        ...(value.socials || []),
                        { label: "", url: "https://" },
                      ],
                    })
                  }
                >
                  Add social link +
                </button>
              </>
            )}
          </fieldset>
          <div className="actions form-footer">
            <button disabled={busy}>
              {busy ? "Saving…" : "Save website draft"}
            </button>
            {dirty && <span className="muted">Unsaved changes</span>}
          </div>
          {message && <Notice>{message}</Notice>}
        </form>
      )}
      <section className="panel">
        <h3>Publication history</h3>
        {publications.length ? (
          publications.slice(0, 10).map((p) => (
            <div className="record-row" key={p.id}>
              <div>
                <strong>{p.status}</strong>
                <small>
                  {new Date(p.created_at).toLocaleString()} · {p.id}
                </small>
              </div>
              <button
                disabled={busy}
                className="secondary"
                onClick={() => checkLive(p.id)}
              >
                Check live version
              </button>
            </div>
          ))
        ) : (
          <p>
            No workspace publications yet. The existing public website remains
            live.
          </p>
        )}
      </section>
      {confirm && (
        <ConfirmDialog
          title="Publish this website draft?"
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={publish}
        >
          <p>
            This publishes saved draft version {initial.version} and requests a
            new Vercel build. Only public company, service and contact
            information belongs in this draft.
          </p>
          {message && <p className="error">{message}</p>}
        </ConfirmDialog>
      )}
    </>
  );
}

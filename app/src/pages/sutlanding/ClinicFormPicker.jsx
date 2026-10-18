import SearchableSelect from "../../components/SearchableSelect";
import { toDisplayText } from "../../utils/textPresentation.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowRight,
  FiCheck,
  FiChevronUp,
  FiClipboard,
  FiGrid,
  FiHome,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { translateTextSmart } from "../../utils/translator";
import bgClinicFallback from "../../assets/bg-new.jpg";
import "./ClinicFormPicker.css";

const ALL = "all";
const BAND_THEMES = ["cfp-band--blue", "cfp-band--pink", "cfp-band--green"];
const POPULAR_LIMIT = 3;
// "All clinics" shows a preview row per clinic; filtered views page in batches.
const GROUP_LIMIT = 3;
const PAGE_SIZE = 12;
// Shared links can preselect an organization: /?org=<organization code>.
const ORG_PARAM = "org";

// Clinics carry their organization from GET /clinics; code is stable for URLs.
function organizationKey(clinic) {
  if (clinic.organization_code) return String(clinic.organization_code);
  if (clinic.organization_id != null) return `id-${clinic.organization_id}`;
  return "";
}

function stripHtml(html) {
  return toDisplayText(html);
}

function Highlight({ text, query }) {
  text = toDisplayText(text);
  if (!query) return text;
  const lower = text.toLowerCase();
  const parts = [];
  let from = 0;
  let at = lower.indexOf(query, from);
  while (at > -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + query.length)}</mark>);
    from = at + query.length;
    at = lower.indexOf(query, from);
  }
  parts.push(text.slice(from));
  return parts;
}

function useLocalizedText(text) {
  const { i18n } = useTranslation();
  const [value, setValue] = useState(text);
  useEffect(() => {
    let active = true;
    if (i18n.language === "en" && text) {
      translateTextSmart(text).then((result) => active && setValue(result));
    } else {
      setValue(text);
    }
    return () => {
      active = false;
    };
  }, [i18n.language, text]);
  return value;
}

function ClinicIcon({ clinic, className = "" }) {
  const showIcon = clinic.show_icon === 1 || clinic.show_icon === undefined;
  if (!showIcon || !clinic.image) return null;
  return (
    <span className={`cfp-icon ${className}`}>
      <img src={clinic.image} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

function FormCard({
  form,
  index,
  query,
  clinicLabel,
  orgLabel,
  isPopular,
  count,
}) {
  const { t } = useTranslation();
  const rawTitle = toDisplayText(form.title) || t("form_card.no_title");
  const rawDesc = stripHtml(form.description) || t("form_card.default_desc");
  const title = useLocalizedText(rawTitle);
  const desc = useLocalizedText(rawDesc);
  // Highlight only when showing the original (untranslated) text.
  const hl = title === rawTitle ? query : "";

  return (
    <Link
      to={`/assessment/${form.id}`}
      className={`cfp-card ${form.image ? "" : "cfp-card--no-image"}`}
    >
      <div
        className={`cfp-card__media ${form.image ? "" : BAND_THEMES[index % BAND_THEMES.length]}`}
      >
        {form.image ? (
          <img src={form.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="cfp-card__glyph" aria-hidden="true">
            <FiClipboard />
          </span>
        )}
      </div>
      <div className="cfp-card__body">
        {(clinicLabel || orgLabel || isPopular) && (
          <div className="cfp-card__meta">
            {orgLabel && (
              <span className="cfp-tag cfp-tag--org">
                <Highlight text={orgLabel} query={query} />
              </span>
            )}
            {clinicLabel && (
              <span className="cfp-tag">
                <Highlight text={clinicLabel} query={query} />
              </span>
            )}
            {isPopular && (
              <span className="cfp-tag cfp-tag--hot">
                {t("clinic_picker.popular")}
              </span>
            )}
          </div>
        )}
        <h4 className="cfp-card__title">
          <Highlight text={title} query={hl} />
        </h4>
        <p className="cfp-card__desc">
          <Highlight text={desc} query={desc === rawDesc ? query : ""} />
        </p>
      </div>
      <div className="cfp-card__foot">
        <span className="cfp-card__count">
          <FiUsers aria-hidden="true" />
          {count === undefined ? (
            t("form_card.loading")
          ) : count > 0 ? (
            <span>
              <strong>{Number(count).toLocaleString()}</strong>{" "}
              {t("clinic_picker.done_by")}
            </span>
          ) : (
            t("clinic_picker.no_one_yet")
          )}
        </span>
        <span className="cfp-card__go">
          {t("clinic_picker.start")} <FiArrowRight aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export default function ClinicFormPicker({ clinics, forms, counts, loading }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clinicSlug, setClinicSlug] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isStuck, setIsStuck] = useState(false);
  const searchRef = useRef(null);
  const tilesRef = useRef(null);
  const sentinelRef = useRef(null);
  const focusIndexRef = useRef(null);

  const clinicName = (clinic) =>
    i18n.language === "en" && clinic.name_en ? clinic.name_en : clinic.name;
  const clinicBySlug = useMemo(
    () => Object.fromEntries(clinics.map((c) => [c.slug, c])),
    [clinics],
  );
  const organizations = useMemo(() => {
    const list = [];
    const byKey = {};
    clinics.forEach((clinic) => {
      const key = organizationKey(clinic);
      if (!key) return;
      if (!byKey[key]) {
        byKey[key] = {
          key,
          name: clinic.organization_name || clinic.organization_code || key,
          slugs: [],
        };
        list.push(byKey[key]);
      }
      byKey[key].slugs.push(clinic.slug);
    });
    return list;
  }, [clinics]);
  // A single-organization deployment keeps the plain clinic picker.
  const multiOrg = organizations.length > 1;
  const requestedOrg = searchParams.get(ORG_PARAM) || ALL;
  const selectedOrg = multiOrg
    ? organizations.find((org) => org.key === requestedOrg) || null
    : null;
  const orgKey = selectedOrg ? selectedOrg.key : ALL;
  const orgName = (clinic) =>
    multiOrg
      ? organizations.find((o) => o.key === organizationKey(clinic))?.name || ""
      : "";
  const visibleClinics = selectedOrg
    ? clinics.filter((clinic) => organizationKey(clinic) === orgKey)
    : clinics;

  const selectOrg = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === ALL) next.delete(ORG_PARAM);
    else next.set(ORG_PARAM, key);
    setSearchParams(next, { replace: true, preventScrollReset: true });
    setClinicSlug(ALL);
  };

  const formsByClinic = useMemo(() => {
    const map = {};
    forms.forEach((form) => {
      const slug = form.clinic_type || "general";
      (map[slug] ||= []).push(form);
    });
    return map;
  }, [forms]);

  const popularIds = useMemo(() => {
    const ranked = forms
      .filter((f) => (counts[f.id] || 0) > 0)
      .sort((a, b) => counts[b.id] - counts[a.id]);
    return new Set(ranked.slice(0, POPULAR_LIMIT).map((f) => f.id));
  }, [forms, counts]);

  const q = query.trim().toLowerCase();
  const sortForms = (list) => {
    if (sort === "popular")
      return [...list].sort(
        (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0),
      );
    if (sort === "name")
      return [...list].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", "th"),
      );
    return list;
  };

  const orgFormCount = (org) =>
    org.slugs.reduce(
      (sum, slug) => sum + (formsByClinic[slug] || []).length,
      0,
    );
  const orgForms = selectedOrg
    ? forms.filter((f) =>
        selectedOrg.slugs.includes(f.clinic_type || "general"),
      )
    : forms;
  const scoped =
    clinicSlug === ALL ? orgForms : formsByClinic[clinicSlug] || [];
  const results = sortForms(
    q
      ? scoped.filter((f) => {
          const clinic = clinicBySlug[f.clinic_type || "general"];
          const haystack = `${f.title || ""} ${stripHtml(f.description)} ${clinic ? `${clinicName(clinic)} ${orgName(clinic)}` : ""}`;
          return haystack.toLowerCase().includes(q);
        })
      : scoped,
  );
  const selectedClinic = clinicSlug === ALL ? null : clinicBySlug[clinicSlug];
  const scopeLabel = selectedClinic
    ? clinicName(selectedClinic)
    : selectedOrg
      ? selectedOrg.name
      : t("clinic_picker.all_clinics");
  const grouped = clinicSlug === ALL && !q;
  const visibleResults = results.slice(0, visibleCount);
  const remaining = results.length - visibleResults.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [clinicSlug, orgKey, q, sort]);

  // Move focus to the first newly revealed card after "show more".
  useEffect(() => {
    if (focusIndexRef.current === null) return;
    const cards = document.querySelectorAll("#cfp-results .cfp-card");
    cards[focusIndexRef.current]?.focus();
    focusIndexRef.current = null;
  }, [visibleCount]);

  // The toolbar is sticky; detect when it is stuck under the navbar.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top < 120),
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const smoothScroll = (element) => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  const openClinic = (slug) => {
    setClinicSlug(slug);
    window.requestAnimationFrame(() => smoothScroll(sentinelRef.current));
  };

  const loadMore = () => {
    focusIndexRef.current = visibleCount;
    setVisibleCount((count) => count + PAGE_SIZE);
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey) return;
      const tag = document.activeElement?.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resetFilters = () => {
    setClinicSlug(ALL);
    setQuery("");
  };
  // Organization is already shown by the group or the chosen chip.
  const showOrgOnCards = multiOrg && !selectedOrg;

  const renderCard = (form, index, showClinic) => {
    const clinic = clinicBySlug[form.clinic_type || "general"];
    return (
      <FormCard
        key={form.id}
        form={form}
        index={index}
        query={q}
        clinicLabel={showClinic && clinic ? clinicName(clinic) : ""}
        orgLabel={showClinic && showOrgOnCards && clinic ? orgName(clinic) : ""}
        isPopular={popularIds.has(form.id)}
        count={counts[form.id]}
      />
    );
  };

  return (
    <div className="cfp">
      <div className="cfp-head">
        <div>
          <h2 className="cfp-title">
            {selectedOrg
              ? t("clinic_picker.title_org", { org: selectedOrg.name })
              : t("clinic_picker.title")}
          </h2>
          <p className="cfp-sub">
            {multiOrg
              ? t("clinic_picker.subtitle_multi")
              : t("clinic_picker.subtitle")}
          </p>
        </div>
        <label className="cfp-search">
          <FiSearch aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            placeholder={t("clinic_picker.search_placeholder")}
            aria-label={t("clinic_picker.search_label")}
            aria-controls="cfp-results"
          />
          {query ? (
            <button
              type="button"
              className="cfp-search__clear"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              <FiX aria-hidden="true" /> {t("clinic_picker.clear")}
            </button>
          ) : (
            <kbd className="cfp-search__kbd" aria-hidden="true">
              /
            </kbd>
          )}
        </label>
      </div>

      {multiOrg && (
        <div
          className="cfp-orgs"
          role="group"
          aria-label={t("clinic_picker.orgs_label")}
        >
          <span className="cfp-orgs__label" aria-hidden="true">
            {t("clinic_picker.orgs_label")}
          </span>
          <div className="cfp-orgs__list">
            <button
              type="button"
              className="cfp-org"
              aria-pressed={!selectedOrg}
              onClick={() => selectOrg(ALL)}
            >
              <FiGrid aria-hidden="true" />
              <span className="cfp-org__name">
                {t("clinic_picker.all_orgs")}
              </span>
              <span className="cfp-org__count">{forms.length}</span>
            </button>
            {organizations.map((org) => (
              <button
                type="button"
                key={org.key}
                className="cfp-org"
                aria-pressed={selectedOrg?.key === org.key}
                onClick={() => selectOrg(org.key)}
              >
                <FiHome aria-hidden="true" />
                <span className="cfp-org__name">{org.name}</span>
                <span className="cfp-org__count">{orgFormCount(org)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={tilesRef}
        className="cfp-tiles"
        role="group"
        aria-label={t("clinic_picker.clinics_label")}
      >
        <button
          type="button"
          className="cfp-tile cfp-tile--all"
          aria-pressed={clinicSlug === ALL}
          onClick={() => setClinicSlug(ALL)}
        >
          <span className="cfp-tile__check" aria-hidden="true">
            <FiCheck />
          </span>
          <span className="cfp-tile__glyph" aria-hidden="true">
            <FiGrid />
          </span>
          <span className="cfp-tile__name">
            {t("clinic_picker.all_clinics")}
          </span>
          <span className="cfp-tile__count">
            {t("clinic_picker.form_count", { count: orgForms.length })}
          </span>
        </button>
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="cfp-tile cfp-tile--skeleton" />
            ))
          : visibleClinics.map((clinic) => (
              <button
                type="button"
                key={clinic.slug}
                className="cfp-tile"
                aria-pressed={clinicSlug === clinic.slug}
                onClick={() => setClinicSlug(clinic.slug)}
                style={{
                  backgroundImage: `url(${clinic.bg || bgClinicFallback})`,
                }}
              >
                <span className="cfp-tile__check" aria-hidden="true">
                  <FiCheck />
                </span>
                <ClinicIcon clinic={clinic} className="cfp-tile__icon" />
                {showOrgOnCards && orgName(clinic) && (
                  <span className="cfp-tile__org">{orgName(clinic)}</span>
                )}
                <span className="cfp-tile__name">{clinicName(clinic)}</span>
                <span className="cfp-tile__count">
                  {t("clinic_picker.form_count", {
                    count: (formsByClinic[clinic.slug] || []).length,
                  })}
                </span>
              </button>
            ))}
      </div>

      <div ref={sentinelRef} className="cfp-sentinel" aria-hidden="true" />
      <div className={`cfp-toolbar ${isStuck ? "is-stuck" : ""}`}>
        <div className="cfp-toolbar__info">
          {isStuck && (
            <button
              type="button"
              className="cfp-toolbar__up"
              onClick={() => smoothScroll(tilesRef.current)}
            >
              <FiChevronUp aria-hidden="true" />
              {t("clinic_picker.pick_clinic")}
            </button>
          )}
          {selectedOrg && !selectedClinic && (
            <span className="cfp-scope">
              <FiHome aria-hidden="true" className="cfp-scope__glyph" />
              {selectedOrg.name}
              <button
                type="button"
                className="cfp-scope__remove"
                onClick={() => selectOrg(ALL)}
                aria-label={t("clinic_picker.remove_org_filter")}
              >
                <FiX aria-hidden="true" />
              </button>
            </span>
          )}
          {selectedClinic && (
            <span className="cfp-scope">
              <ClinicIcon clinic={selectedClinic} className="cfp-scope__icon" />
              {clinicName(selectedClinic)}
              <button
                type="button"
                className="cfp-scope__remove"
                onClick={() => setClinicSlug(ALL)}
                aria-label={t("clinic_picker.remove_clinic_filter")}
              >
                <FiX aria-hidden="true" />
              </button>
            </span>
          )}
          <p className="cfp-toolbar__count" aria-live="polite">
            {q
              ? t("clinic_picker.result_search", {
                  count: results.length,
                  query: query.trim(),
                  scope: scopeLabel,
                })
              : t("clinic_picker.result_count", { count: results.length })}
          </p>
        </div>
        <div className="cfp-toolbar__actions">
          {q && (
            <button type="button" className="cfp-link" onClick={resetFilters}>
              {t("clinic_picker.reset")}
            </button>
          )}
          <label className="cfp-sort">
            <span>{t("clinic_picker.sort_label")}</span>
            <SearchableSelect
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="default">{t("clinic_picker.sort_default")}</option>
              <option value="popular">{t("clinic_picker.sort_popular")}</option>
              <option value="name">{t("clinic_picker.sort_name")}</option>
            </SearchableSelect>
          </label>
        </div>
      </div>

      <div id="cfp-results">
        {loading ? (
          <p className="cfp-empty">{t("sutlanding.loading")}</p>
        ) : results.length === 0 ? (
          <div className="cfp-empty">
            <h3>
              {q
                ? t("clinic_picker.empty_search", { query: query.trim() })
                : t("sutlanding.no_form_in_clinic")}
            </h3>
            {(q || clinicSlug !== ALL || selectedOrg) && (
              <button
                type="button"
                className="cfp-link"
                onClick={() => {
                  resetFilters();
                  if (selectedOrg) selectOrg(ALL);
                }}
              >
                {t("clinic_picker.show_all")}
              </button>
            )}
          </div>
        ) : grouped ? (
          visibleClinics
            .filter((clinic) => (formsByClinic[clinic.slug] || []).length)
            .map((clinic) => {
              const list = sortForms(formsByClinic[clinic.slug]);
              const hidden = list.length - GROUP_LIMIT;
              return (
                <section className="cfp-group" key={clinic.slug}>
                  <header className="cfp-group__head">
                    <ClinicIcon clinic={clinic} className="cfp-group__icon" />
                    <h3>{clinicName(clinic)}</h3>
                    {showOrgOnCards && orgName(clinic) && (
                      <span className="cfp-tag cfp-tag--org">
                        {orgName(clinic)}
                      </span>
                    )}
                    <span className="cfp-group__count">
                      {t("clinic_picker.form_count", { count: list.length })}
                    </span>
                    <button
                      type="button"
                      className="cfp-group__more"
                      onClick={() => openClinic(clinic.slug)}
                    >
                      {hidden > 0
                        ? t("clinic_picker.view_all_count", {
                            count: list.length,
                          })
                        : t("clinic_picker.only_this_clinic")}{" "}
                      <FiArrowRight aria-hidden="true" />
                    </button>
                  </header>
                  <div className="cfp-grid">
                    {list
                      .slice(0, GROUP_LIMIT)
                      .map((form, i) => renderCard(form, i, false))}
                  </div>
                  {hidden > 0 && (
                    <button
                      type="button"
                      className="cfp-more"
                      onClick={() => openClinic(clinic.slug)}
                    >
                      {t("clinic_picker.more_in_clinic", {
                        count: hidden,
                        clinic: clinicName(clinic),
                      })}
                      <FiArrowRight aria-hidden="true" />
                    </button>
                  )}
                </section>
              );
            })
        ) : (
          <>
            <div className="cfp-grid">
              {visibleResults.map((form, i) =>
                renderCard(form, i, clinicSlug === ALL),
              )}
            </div>
            {results.length > PAGE_SIZE && (
              <div className="cfp-pager">
                <p>
                  {t("clinic_picker.showing", {
                    shown: visibleResults.length,
                    total: results.length,
                  })}
                </p>
                <span className="cfp-pager__bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${(visibleResults.length / results.length) * 100}%`,
                    }}
                  />
                </span>
                {remaining > 0 && (
                  <button
                    type="button"
                    className="cfp-pager__btn"
                    onClick={loadMore}
                  >
                    {t("clinic_picker.load_more", {
                      count: Math.min(PAGE_SIZE, remaining),
                    })}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

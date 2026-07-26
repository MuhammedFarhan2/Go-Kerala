import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const FIELD_LABELS = {
  from: "From",
  to: "To",
  location: "Location"
};

export default function App() {
  const [form, setForm] = useState({
    from: "",
    to: "",
    location: ""
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeField, setActiveField] = useState("location");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const cacheRef = useRef({});
  const suggestionsRef = useRef(null);
  const suppressNextSearchRef = useRef(false);

  const currentInputValue = form[activeField];

  useEffect(() => {
    const text = currentInputValue.trim();

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    setQuery(text);
    setPage(0);
    setSuggestions([]);
    setHasMore(true);

    if (!text) {
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      loadPlaces(text, 0, true);
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInputValue, activeField]);

  const loadPlaces = async (searchText, nextPage, reset = false) => {
    if (loading) return;

    const key = `${searchText.toLowerCase()}_${nextPage}`;
    setLoading(true);

    try {
      let data = cacheRef.current[key];

      if (!data) {
        const offset = nextPage * 50;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=50&offset=${offset}&addressdetails=1&q=${encodeURIComponent(
            searchText
          )}`
        );
        data = await response.json();

        const seen = new Set();
        data = data.filter((place) => {
          const name = place.display_name.toLowerCase();
          if (seen.has(name)) return false;
          seen.add(name);
          return true;
        });

        const q = searchText.toLowerCase();
        data.sort((a, b) => {
          const aName = a.display_name.toLowerCase();
          const bName = b.display_name.toLowerCase();
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        });

        cacheRef.current[key] = data;
      }

      setSuggestions((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === 50);
      setPage(nextPage);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    const el = suggestionsRef.current;
    if (!el || loading || !hasMore || !query) return;

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      loadPlaces(query, page + 1, false);
    }
  };

  const selectPlace = (place) => {
    const display = place.display_name;

    suppressNextSearchRef.current = true;
    setForm((prev) => ({
      ...prev,
      [activeField]: display
    }));
    setSelectedPlace(place);
    setSuggestions([]);
    setHasMore(false);

  };

  const clearField = (field) => {
    setForm((prev) => ({ ...prev, [field]: "" }));
    if (activeField === field) {
      setSuggestions([]);
    }
  };

  const fillActiveField = (value) => {
    setForm((prev) => ({ ...prev, [activeField]: value }));
  };

  const fieldHint = useMemo(() => {
    return `${FIELD_LABELS[activeField]} search in India`;
  }, [activeField]);

  return (
    <div className="app-shell">
      <button
        type="button"
        className="account-trigger"
        onClick={() => setAccountOpen((prev) => !prev)}
        aria-expanded={accountOpen}
        aria-controls="account-drawer"
        aria-label="Open account panel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12.25a4.25 4.25 0 1 0-4.25-4.25A4.25 4.25 0 0 0 12 12.25Zm0 2.25c-4.15 0-7.5 2.72-7.5 6.08A1.42 1.42 0 0 0 5.92 22h12.16a1.42 1.42 0 0 0 1.42-1.42c0-3.61-3.35-6.08-7.5-6.08Z" />
        </svg>
      </button>

      <div className={`account-drawer-backdrop ${accountOpen ? "open" : ""}`} onClick={() => setAccountOpen(false)} />
      <aside id="account-drawer" className={`account-drawer ${accountOpen ? "open" : ""}`} aria-hidden={!accountOpen}>
        <div className="drawer-top">
          <div className="account-card">
            <div className="account-avatar">H</div>
            <div className="account-meta">
              <p className="account-label">Gmail Account</p>
              <strong>HP User</strong>
              <span>hp.user@gmail.com</span>
            </div>
          </div>
        </div>

        <div className="drawer-bottom">
          <button type="button" className="drawer-link">Feedback</button>
          <button type="button" className="drawer-link drawer-link-danger">Logout</button>
          <div className="drawer-blank-space" aria-hidden="true" />
        </div>
      </aside>

      <div className="panel">
        <div className="panel-copy">
          <p className="eyebrow">Place search</p>
          <h1>Fill your route and location fields from India search suggestions</h1>
          <p className="subcopy">
            Click a field, start typing a place, then choose a suggestion to place
            it into `from`, `to`, or `location`.
          </p>
        </div>

        <div className="form-grid">
          {Object.entries(FIELD_LABELS).map(([field, label]) => (
            <label key={field} className={`field ${activeField === field ? "active" : ""}`}>
              <span>{label}</span>
              <div className="field-row">
                <input
                  value={form[field]}
                  onFocus={() => setActiveField(field)}
                  onChange={(e) => {
                    setActiveField(field);
                    fillActiveField(e.target.value);
                  }}
                  placeholder={`Search ${label.toLowerCase()}...`}
                />
                {form[field] ? (
                  <button type="button" className="clear-btn" onClick={() => clearField(field)}>
                    Clear
                  </button>
                ) : null}
              </div>
            </label>
          ))}
        </div>

        <div className="search-area">
          <div className="search-header">
            <strong>{fieldHint}</strong>
            <span>{loading ? "Searching..." : "Choose a place to fill the active field"}</span>
          </div>

          <div className="suggestions" ref={suggestionsRef} onScroll={handleScroll}>
            {suggestions.length === 0 && query ? (
              <div className="empty-state">No suggestions yet. Keep typing or wait a moment.</div>
            ) : null}

            {suggestions.map((place) => (
              <button
                type="button"
                key={`${place.place_id}-${place.display_name}`}
                className="suggestion-item"
                onClick={() => selectPlace(place)}
              >
                {place.display_name}
              </button>
            ))}

            {loading ? <div className="empty-state">Loading more places...</div> : null}
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              if (selectedPlace) {
                alert(`Selected: ${selectedPlace.display_name}`);
              } else {
                alert(`From: ${form.from}\nTo: ${form.to}\nLocation: ${form.location}`);
              }
            }}
          >
            Use Selected Place
          </button>
        </div>
      </div>

      <div className="map-wrap">
        <div id="map" className="map">
          <div className="map-placeholder">
            <strong>Map preview</strong>
            <span>Selected place details will appear here.</span>
            {selectedPlace ? (
              <p>
                {selectedPlace.display_name}
                <br />
                {selectedPlace.lat}, {selectedPlace.lon}
              </p>
            ) : null}
          </div>
        </div>
        <div className="map-footer">
          <span>Selected place</span>
          <strong>{selectedPlace ? selectedPlace.display_name : "None yet"}</strong>
        </div>
      </div>
    </div>
  );
}

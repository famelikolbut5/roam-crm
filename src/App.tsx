import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  MapPin,
  Plus,
  Search,
  Users,
  LayoutGrid,
  Route,
  ArrowUpRight,
  Phone,
  X,
} from "lucide-react";
import { api, dateLabel, money } from "./api";
import { Dialog } from "./Dialog";

type Lead = {
  id: string;
  name: string;
  destination: string;
  people: number;
  budget_minor: number;
  date: string;
  email: string;
  status: string;
};
type Guest = { id: string; name: string; checked: boolean };
type Trip = {
  id: string;
  title: string;
  date: string;
  guide: string;
  capacity: number;
  route: { time: string; title: string; note: string }[];
  guests: Guest[];
};
const stages: Record<string, string> = {
  new: "Новые",
  discuss: "Обсуждение",
  booked: "Забронировано",
  complete: "Завершено",
};
const pages = [
  { key: "leads", title: "Заявки", icon: LayoutGrid },
  { key: "trips", title: "Поездки", icon: Compass },
  { key: "clients", title: "Клиенты", icon: Users },
  { key: "guide", title: "Маршрут гида", icon: Route },
];

function RouteMap() {
  return (
    <svg
      className="route-map"
      viewBox="0 0 600 320"
      role="img"
      aria-label="Схема маршрута: вокзал, горный парк, озеро"
    >
      <rect width="600" height="320" fill="#e9eddd" />
      <path
        d="M0 32Q130 70 230 22T600 64M0 200Q150 120 300 220T600 180"
        fill="none"
        stroke="#d6dec7"
        strokeWidth="46"
      />
      <path
        d="M420-20Q350 60 400 130T330 340"
        fill="none"
        stroke="#b8d8df"
        strokeWidth="80"
      />
      <path
        d="M50 0L150 320M280 0L180 320M0 100L600 230M0 250L600 70"
        stroke="#f9faf4"
        strokeWidth="12"
        fill="none"
      />
      <path
        d="M92 240C90 95 210 235 254 122S370 36 440 112"
        fill="none"
        stroke="#7a61c9"
        strokeWidth="4"
        strokeDasharray="7 6"
      />
      {[
        [92, 240],
        [254, 122],
        [440, 112],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="16" fill="#fff" />
          <circle cx={x} cy={y} r="11" fill="#6b50b5" />
          <text
            x={x}
            y={y + 4}
            fill="#fff"
            fontSize="12"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            {i + 1}
          </text>
        </g>
      ))}
      <g fill="#56664e" fontSize="12" fontFamily="sans-serif">
        <text x="58" y="274">
          Вокзал
        </text>
        <text x="195" y="91">
          Горный парк
        </text>
        <text x="458" y="147">
          Озеро
        </text>
      </g>
    </svg>
  );
}

export function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [page, setPage] = useState("leads");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragged, setDragged] = useState<string | null>(null);
  const close = useCallback(() => {
    setSelected(null);
    setCreating(false);
    setError("");
  }, []);
  async function load() {
    try {
      const [l, t] = await Promise.all([
        api<Lead[]>("/leads"),
        api<Trip[]>("/trips"),
      ]);
      setLeads(l);
      setTrips(t);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function move(id: string, status: string) {
    setBusy(true);
    try {
      const lead = await api<Lead>("/leads/" + id, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setLeads((l) => l.map((x) => (x.id === id ? lead : x)));
      if (selected?.id === id) setSelected(lead);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setDragged(null);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const lead = await api<Lead>("/leads", {
        method: "POST",
        body: JSON.stringify({
          ...fields,
          people: Number(fields.people),
          budget_minor: Math.round(Number(fields.budget) * 100),
        }),
      });
      setLeads((l) => [lead, ...l]);
      setCreating(false);
      setSearch("");
      setSelected(lead);
      setPage("leads");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkIn(guest: Guest) {
    setBusy(true);
    try {
      const updated = await api<Guest>("/guests/" + guest.id, {
        method: "PATCH",
        body: JSON.stringify({ checked: !guest.checked }),
      });
      setTrips((t) =>
        t.map((trip) => ({
          ...trip,
          guests: trip.guests.map((g) => (g.id === guest.id ? updated : g)),
        })),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = leads.filter((l) =>
    (l.name + " " + l.destination + " " + l.email)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const trip = trips[0];
  const heading = pages.find((p) => p.key === page)!.title;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <Compass size={29} strokeWidth={1.8} />
          roam<span>crm</span>
        </a>
        <div className="workspace">
          <span className="avatar">Л</span>
          <div>
            <b>Линия путешествий</b>
            <small>Туристическая команда</small>
          </div>
        </div>
        <nav aria-label="Разделы CRM">
          {pages.map(({ key, title, icon: Icon }) => (
            <button
              key={key}
              className={page === key ? "selected" : ""}
              onClick={() => {
                setPage(key);
                setSearch("");
              }}
            >
              <Icon size={19} />
              <span>{title}</span>
              {key === "leads" && (
                <small>
                  {leads.filter((l) => l.status !== "complete").length}
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar person">ЕС</span>
          <div>
            <b>Елена Соколова</b>
            <small>Менеджер путешествий</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Линия путешествий <ChevronRight size={14} /> {heading}
          </span>
          <span className="top-avatar">ЕС</span>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <h1>
                {page === "leads" ? "Путешествие начинается здесь" : heading}
              </h1>
              <p>
                {page === "leads"
                  ? "Все обращения и бронирования вашей команды"
                  : page === "guide"
                    ? "План дня и участники поездки"
                    : page === "trips"
                      ? "Маршруты, группа и детали поездки"
                      : "Контакты и запросы путешественников"}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setCreating(true);
                setError("");
              }}
            >
              <Plus size={18} />
              Новая заявка
            </button>
          </div>
          {error && !selected && !creating && (
            <p className="error" role="alert">
              {error} <button onClick={() => void load()}>Повторить</button>
            </p>
          )}
          {loading ? (
            <div className="empty">Загружаем рабочее пространство</div>
          ) : (
            <>
              {(page === "leads" || page === "clients") && (
                <div className="board-toolbar">
                  <div className="view-label">
                    <LayoutGrid size={17} />
                    <b>{page === "leads" ? "Воронка заявок" : "Клиенты"}</b>
                    <span>{filtered.length}</span>
                  </div>
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Поиск заявок"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Клиент или направление"
                    />
                    {search && (
                      <button
                        className="icon-button"
                        aria-label="Очистить поиск"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                </div>
              )}
              {page === "leads" && (
                <div className="board">
                  {Object.entries(stages).map(([status, title]) => {
                    const group = filtered.filter((l) => l.status === status);
                    return (
                      <section
                        key={status}
                        className={
                          "column " + status + (dragged ? " drop-ready" : "")
                        }
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain");
                          if (leads.some((l) => l.id === id) && !busy)
                            void move(id, status);
                        }}
                      >
                        <header>
                          <span className="stage-dot" />
                          <h2>{title}</h2>
                          <span className="count">{group.length}</span>
                        </header>
                        <p className="column-total">
                          {money(group.reduce((n, l) => n + l.budget_minor, 0))}
                        </p>
                        <div className="cards">
                          {group.map((lead) => (
                            <button
                              key={lead.id}
                              className="lead-card"
                              draggable
                              onDragStart={(e) => {
                                setDragged(lead.id);
                                e.dataTransfer.setData("text/plain", lead.id);
                              }}
                              onDragEnd={() => setDragged(null)}
                              onClick={() => {
                                setSelected(lead);
                                setError("");
                              }}
                            >
                              <span className="destination">
                                <MapPin size={14} />
                                {lead.destination}
                              </span>
                              <h3>{lead.name}</h3>
                              <strong className="budget">
                                {money(lead.budget_minor)}
                              </strong>
                              <div className="lead-meta">
                                <span>
                                  <CalendarDays size={14} />
                                  {dateLabel(lead.date)}
                                </span>
                                <span>
                                  <Users size={14} />
                                  {lead.people} чел.
                                </span>
                              </div>
                              <footer>
                                <span className="mini-avatar">
                                  {lead.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </span>
                                <span>
                                  {status === "new"
                                    ? "Уточнить пожелания"
                                    : status === "discuss"
                                      ? "Подобрать маршрут"
                                      : status === "booked"
                                        ? "Подтвердить детали"
                                        : "Поездка завершена"}
                                </span>
                                <ArrowUpRight size={15} />
                              </footer>
                            </button>
                          ))}
                        </div>
                        {!group.length && (
                          <p className="column-empty">
                            {search ? "Нет совпадений" : "Заявок пока нет"}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              {page === "clients" && (
                <div className="client-list">
                  {filtered.map((l) => (
                    <button key={l.id} onClick={() => setSelected(l)}>
                      <span className="avatar person">
                        {l.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <span>
                        <b>{l.name}</b>
                        <small>{l.email}</small>
                      </span>
                      <span className="client-destination">
                        {l.destination}
                      </span>
                      <span className={"stage-pill " + l.status}>
                        {stages[l.status]}
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                  {!filtered.length && (
                    <p className="empty">Клиенты не найдены. Измените поиск.</p>
                  )}
                </div>
              )}
              {page === "trips" &&
                trips.map((t) => (
                  <article key={t.id} className="trip-card">
                    <div className="trip-art">
                      <RouteMap />
                      <span className="trip-date">{dateLabel(t.date)}</span>
                    </div>
                    <div className="trip-description">
                      <p className="destination">
                        <MapPin size={15} />
                        Карелия
                      </p>
                      <h2>{t.title}</h2>
                      <p>Парк, озеро и день вдали от города.</p>
                      <dl>
                        <div>
                          <dt>Гид</dt>
                          <dd>{t.guide}</dd>
                        </div>
                        <div>
                          <dt>Группа</dt>
                          <dd>
                            {t.guests.length} из {t.capacity} мест
                          </dd>
                        </div>
                        <div>
                          <dt>Остановки</dt>
                          <dd>{t.route.length}</dd>
                        </div>
                      </dl>
                      <button
                        className="primary"
                        onClick={() => setPage("guide")}
                      >
                        Открыть маршрут <ChevronRight size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              {page === "guide" && trip && (
                <div className="guide-layout">
                  <section className="route-panel">
                    <div className="guide-header">
                      <span className="destination">
                        <Compass size={17} />
                        Маршрут дня
                      </span>
                      <h2>{trip.title}</h2>
                      <p>
                        {dateLabel(trip.date)} / {trip.guide}
                      </p>
                    </div>
                    <RouteMap />
                    <ol className="stops">
                      {trip.route.map((stop, i) => (
                        <li key={stop.time}>
                          <span className="stop-time">{stop.time}</span>
                          <span className="stop-number">{i + 1}</span>
                          <div>
                            <h3>{stop.title}</h3>
                            <p>{stop.note}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="guest-panel">
                    <header>
                      <h2>Участники</h2>
                      <span>
                        {trip.guests.filter((g) => g.checked).length} /{" "}
                        {trip.guests.length}
                      </span>
                    </header>
                    <p>Отметьте тех, кто уже на месте</p>
                    <div className="check-progress">
                      <span
                        style={{
                          width:
                            (trip.guests.filter((g) => g.checked).length /
                              trip.guests.length) *
                              100 +
                            "%",
                        }}
                      />
                    </div>
                    {trip.guests.map((g) => (
                      <button
                        disabled={busy}
                        key={g.id}
                        className={"guest " + (g.checked ? "arrived" : "")}
                        aria-pressed={g.checked}
                        onClick={() => void checkIn(g)}
                      >
                        <span className="guest-check">
                          {g.checked && <Check size={16} />}
                        </span>
                        <span>
                          {g.name}
                          <small>{g.checked ? "На месте" : "Ожидаем"}</small>
                        </span>
                      </button>
                    ))}
                    <div className="guide-note">
                      <Phone size={17} />
                      <span>Отметки доступны менеджеру в CRM</span>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          <p className="page-note">
            <span className="live-dot" />
            Заявки и отметки сохраняются автоматически
          </p>
        </div>
      </main>
      {(creating || selected) && (
        <Dialog
          title={creating ? "Новая заявка" : selected!.name}
          close={close}
        >
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {creating ? (
            <form onSubmit={create}>
              <label>
                Имя клиента
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="client@example.com"
                />
              </label>
              <label>
                Направление
                <input
                  name="destination"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Например, Карелия"
                />
              </label>
              <div className="form-row">
                <label>
                  Дата поездки
                  <input
                    name="date"
                    type="date"
                    defaultValue="2026-10-15"
                    required
                  />
                </label>
                <label>
                  Участников
                  <input
                    name="people"
                    type="number"
                    defaultValue="2"
                    min="1"
                    max="50"
                    required
                  />
                </label>
              </div>
              <label>
                Бюджет, ₽
                <input
                  name="budget"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  required
                />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={close}>
                  Отмена
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Сохраняем" : "Добавить заявку"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="record-meta">
                <span className="destination">
                  <MapPin size={16} />
                  {selected!.destination}
                </span>
                <span className={"stage-pill " + selected!.status}>
                  {stages[selected!.status]}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={"mailto:" + selected!.email}>{selected!.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Дата</dt>
                  <dd>{dateLabel(selected!.date)}</dd>
                </div>
                <div>
                  <dt>Участников</dt>
                  <dd>{selected!.people}</dd>
                </div>
                <div>
                  <dt>Бюджет</dt>
                  <dd>{money(selected!.budget_minor)}</dd>
                </div>
              </dl>
              <label className="status-control">
                Этап заявки
                <select
                  aria-label="Изменить этап"
                  disabled={busy}
                  value={selected!.status}
                  onChange={(e) => void move(selected!.id, e.target.value)}
                >
                  {Object.entries(stages).map(([key, title]) => (
                    <option key={key} value={key}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}

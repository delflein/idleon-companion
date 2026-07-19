<script setup>
/**
 * DataTable — the click-header-to-sort table pattern from sailing.html's fleet table (the ONLY
 * legacy page with true column-header sorting; everywhere else "sort" was a `<select>`-driven
 * re-render — docs/migration/survey-pages.md cross-cutting findings). Ports sailing.html's
 * `COLS`/`SORT`/`rows.sort((x,y)=>(sc.get(x)-sc.get(y))*SORT.dir)` pattern generically: click a
 * sortable header to sort ascending by that column's `get(row)`; click again to reverse; the
 * active column shows a ▲/▼ arrow, exactly like sailing.html's
 * `${SORT.col===c.k ? (SORT.dir>0?" ▲":" ▼") : ""}`.
 *
 * Cell content: each column can supply a plain `get(row)` (rendered as text — this is also the
 * SORT KEY, matching sailing.html where e.g. a chance column sorts by `1/chance` while display
 * uses `oneIn()` — so pass a `format(row)` too when the sort key and the display text differ)
 * or the caller can render custom markup per column via a scoped slot named `cell-<key>`.
 *
 * Pure presentational: sort state is local UI state (no store imports), like ShowMore's
 * expand toggle. Emits `sort` so a caller can react (e.g. persist the chosen column) but does
 * not require it.
 */
import { ref, computed } from "vue";

const props = defineProps({
  /** [{ key, label, get(row) -> sortable value, format?(row) -> display text, numeric?: bool,
   *    sortable?: bool (default true) }]. `numeric` right-aligns the column. */
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  /** (row) -> unique key, or a string property name. Falls back to array index. */
  rowKey: { type: [Function, String], default: null },
  /** Initial sort: { col, dir: 1 | -1 }. Defaults to no sort (rows render in given order). */
  initialSort: { type: Object, default: null },
  /** Sticky header while the table scrolls inside a tall panel. */
  sticky: { type: Boolean, default: true },
});
const emit = defineEmits(["sort"]);

const sort = ref(props.initialSort ? { ...props.initialSort } : null);

function keyOf(row, i) {
  if (typeof props.rowKey === "function") return props.rowKey(row, i);
  if (typeof props.rowKey === "string") return row[props.rowKey];
  return i;
}

function onHeaderClick(col) {
  if (col.sortable === false) return;
  sort.value = { col: col.key, dir: sort.value?.col === col.key ? -sort.value.dir : 1 };
  emit("sort", { ...sort.value });
}

const sortedRows = computed(() => {
  if (!sort.value) return props.rows;
  const col = props.columns.find((c) => c.key === sort.value.col);
  if (!col || typeof col.get !== "function") return props.rows;
  const dir = sort.value.dir;
  return [...props.rows].sort((a, b) => {
    const av = col.get(a), bv = col.get(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
});

function displayOf(col, row) {
  if (typeof col.format === "function") return col.format(row);
  if (typeof col.get === "function") return col.get(row);
  return "";
}
</script>

<template>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="{ sortable: col.sortable !== false, num: col.numeric, sticky }"
            @click="onHeaderClick(col)"
          >
            {{ col.label }}<template v-if="sort?.col === col.key">
              {{ sort.dir > 0 ? " ▲" : " ▼" }}
            </template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in sortedRows"
          :key="keyOf(row, i)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :class="{ num: col.numeric }"
          >
            <slot
              :name="`cell-${col.key}`"
              :row="row"
            >
              {{ displayOf(col, row) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
th.sticky { position: sticky; top: 0; background: var(--surface-1); }
</style>

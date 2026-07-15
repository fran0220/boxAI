<template>
  <AppLayout>
    <TablePageLayout>
      <template #filters>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[260px_160px_144px_152px] 2xl:w-auto">
              <div class="min-w-0">
                <SearchInput
                  v-model="filters.taskName"
                  :placeholder="t('batchImage.searchPlaceholder')"
                  class="w-full"
                  @search="applyFilters"
                />
              </div>
              <Select v-model="filters.apiKeyId" :options="apiKeyFilterOptions" class="w-full" @change="applyFilters" />
              <Select v-model="filters.status" :options="statusFilterOptions" class="w-full" @change="applyFilters" />
              <Select v-model="filters.downloaded" :options="downloadFilterOptions" class="w-full" @change="applyFilters" />
            </div>
            <div class="flex flex-wrap items-center justify-start gap-2 sm:justify-end 2xl:flex-shrink-0">
              <button type="button" class="btn btn-secondary" :disabled="loadingJobs" @click="resetFilters">
                {{ t('batchImage.reset') }}
              </button>
              <button type="button" class="btn btn-secondary" :disabled="loadingKeys || loadingJobs" :title="t('batchImage.refresh')" @click="refreshPage">
                <Icon name="refresh" size="md" :class="loadingKeys || loadingJobs ? 'animate-spin' : ''" />
              </button>
              <button type="button" class="btn btn-secondary" @click="showGuideModal = true">
                <Icon name="book" size="md" class="mr-2" />
                {{ t('batchImage.guide') }}
              </button>
              <button type="button" class="btn btn-primary" @click="openCreateModal">
                <Icon name="plus" size="md" class="mr-2" />
                {{ t('batchImage.createJob') }}
              </button>
            </div>
          </div>

          <div
            v-if="selectedJobIds.size"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-elevated)] px-3 py-2 shadow-sm  "
          >
            <span class="text-sm text-[color:var(--bx-text-muted)]">
              {{ t('batchImage.selectedCount', { count: selectedJobIds.size }) }}
            </span>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="bulkDownloading || selectedDownloadableRows.length === 0"
                @click="downloadSelectedJobs"
              >
                <Icon :name="bulkDownloading ? 'refresh' : 'download'" size="sm" class="mr-1.5" :class="bulkDownloading ? 'animate-spin' : ''" />
                {{ t('batchImage.downloadSelected') }}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm text-red-600 hover:text-red-400"
                :disabled="bulkDeleting"
                @click="deleteSelectedJobs"
              >
                <Icon :name="bulkDeleting ? 'refresh' : 'trash'" size="sm" class="mr-1.5" :class="bulkDeleting ? 'animate-spin' : ''" />
                {{ t('batchImage.deleteRecords') }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #table>
        <DataTable
          :columns="columns"
          :data="visibleBatchJobs"
          :loading="loadingKeys || loadingJobs"
          :expandable-actions="false"
          row-key="id"
        >
          <template #header-select>
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              :checked="allVisibleSelected"
              :indeterminate="someVisibleSelected"
              @change="toggleAllVisible(($event.target as HTMLInputElement).checked)"
            />
          </template>

          <template #cell-select="{ row }">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              :checked="selectedJobIds.has(row.id)"
              @change="toggleJobSelection(row.id, ($event.target as HTMLInputElement).checked)"
              @click.stop
            />
          </template>

          <template #cell-id="{ row }">
	            <div class="flex w-[220px] items-start gap-1" :class="row.is_child ? 'pl-6' : ''">
	              <button
	                v-if="row.child_count > 0 && !row.is_child"
	                type="button"
	                class="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[color:var(--bx-text-dim)] transition-colors hover:bg-[color:var(--bx-hover)] hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30   dark:hover:text-white"
	                :title="expandedParentIds.has(row.id) ? t('batchImage.collapseChildren') : t('batchImage.expandChildren', { count: row.child_count })"
	                @click.stop="toggleChildRows(row.id)"
	              >
	                <Icon :name="expandedParentIds.has(row.id) ? 'chevronDown' : 'chevronRight'" size="xs" />
	              </button>
	              <span v-else class="w-6 flex-shrink-0" />
	              <button type="button" class="min-w-0 flex-1 rounded-lg py-1 text-left transition-colors hover:bg-[color:var(--bx-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 " @click="selectJob(row.id)">
	                <span
	                  class="flex min-w-0 items-center gap-2 text-sm font-medium"
	                  :class="row.task_name ? 'text-[color:var(--bx-text)]' : 'text-[color:var(--bx-text-dim)]'"
                >
                  <span class="min-w-0 truncate">{{ row.task_name || defaultTaskName(row.created_at) }}</span>
                  <span v-if="row.child_count > 0 && !row.is_child" class="flex-shrink-0 rounded-full bg-[color:var(--bx-bg-muted)] px-2 py-0.5 text-xs font-normal text-[color:var(--bx-text-muted)]  ">
                    {{ t('batchImage.childJobsCount', { count: row.child_count }) }}
                  </span>
                  <span v-if="row.is_child" class="flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    {{ t('batchImage.childJob') }}
                  </span>
	                </span>
	                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--bx-text-dim)]">
	                  <span>{{ formatDate(row.created_at) }}</span>
	                </span>
	              </button>
	            </div>
	          </template>

          <template #cell-model="{ row }">
	            <div class="mx-auto max-w-[180px] text-center">
	              <p class="truncate text-sm text-[color:var(--bx-text-soft)]" :title="row.model">{{ row.model }}</p>
	            </div>
	          </template>

          <template #cell-api_key_name="{ value }">
            <span class="block truncate text-center text-sm text-[color:var(--bx-text-soft)]">
              {{ value || t('batchImage.notRecorded') }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <div class="flex justify-center">
              <span :class="statusBadgeClass(displayJob(row))" class="badge">
                {{ statusLabel(displayJob(row)) }}
              </span>
            </div>
          </template>

          <template #cell-counts="{ row }">
            <div class="flex items-center justify-center gap-2 text-sm tabular-nums">
              <span class="text-emerald-600 dark:text-emerald-300">{{ displayJob(row).success_count }}</span>
              <span class="text-gray-300 dark:text-dark-500">/</span>
              <span :class="displayJob(row).fail_count > 0 ? 'text-red-600 dark:text-red-300' : 'text-[color:var(--bx-text-dim)]'">{{ displayJob(row).fail_count }}</span>
              <span class="text-xs text-[color:var(--bx-text-dim)]">{{ t('batchImage.totalItems', { count: displayJob(row).item_count }) }}</span>
            </div>
          </template>

          <template #cell-cost="{ row }">
            <span class="block text-center text-sm text-[color:var(--bx-text-soft)]">
              {{ costLabel(displayJob(row)) }}
            </span>
          </template>

          <template #cell-downloaded="{ row }">
            <span class="block text-center text-sm" :class="row.downloaded_at ? 'text-emerald-700 dark:text-emerald-300' : 'text-[color:var(--bx-text-dim)]'">
              {{ row.downloaded_at ? formatDate(row.downloaded_at) : t('batchImage.notDownloaded') }}
            </span>
          </template>

	          <template #cell-actions="{ row }">
	            <div class="flex items-center justify-center gap-1">
              <button
                type="button"
                class="batch-row-action flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-[color:var(--bx-hover)] hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30  dark:hover:text-primary-400"
                :title="t('batchImage.viewDetails')"
                @click="selectJob(row.id)"
              >
                <Icon name="eye" size="sm" />
                <span class="text-xs">{{ t('batchImage.view') }}</span>
              </button>
              <button
                type="button"
                class="batch-row-action flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                :class="canDownload(row) ? 'text-gray-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400' : 'text-gray-300 dark:text-dark-500'"
                :disabled="!canDownload(row) || downloading"
                :title="t('batchImage.downloadZip')"
                @click="downloadJob(row)"
              >
                <Icon
                  :name="isDownloadingJob(row.id) ? 'refresh' : 'download'"
	                  size="sm"
	                  :class="isDownloadingJob(row.id) ? 'animate-spin' : ''"
	                />
                <span class="text-xs">{{ t('batchImage.download') }}</span>
	              </button>
              <div v-if="canRetry(row) || canDeleteRecord(row)">
                <button
                  type="button"
                  class="batch-row-action flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-[color:var(--bx-hover)] hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30  dark:hover:text-white"
                  :class="{ 'bg-[color:var(--bx-bg-muted)] text-[color:var(--bx-text)]  ': openMoreJobId === row.id }"
                  :title="t('batchImage.moreActions')"
                  @click.stop="toggleMoreMenu(row, $event)"
                >
                  <Icon name="more" size="sm" />
                  <span class="text-xs">{{ t('batchImage.more') }}</span>
                </button>
              </div>
	            </div>
	          </template>

          <template #empty>
            <div class="flex min-h-[260px] flex-col items-center justify-center py-6 md:min-h-[300px]">
              <Icon name="sparkles" size="xl" class="mb-4 h-12 w-12 text-[color:var(--bx-text-dim)]" />
              <p class="text-lg font-medium text-[color:var(--bx-text)]">{{ t('batchImage.emptyTitle') }}</p>
              <p class="mt-1 text-sm text-[color:var(--bx-text-dim)]">
                {{ t('batchImage.emptyHint') }}
              </p>
            </div>
          </template>
        </DataTable>
      </template>

      <template #pagination>
        <div
          v-if="visibleBatchJobs.length > 0 || pagination.page > 1"
          class="flex flex-col gap-3 border-t border-[color:var(--bx-border)] bg-[color:var(--bx-bg-elevated)] px-4 py-3   sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div class="flex flex-wrap items-center gap-3 text-sm text-[color:var(--bx-text-soft)]">
            <span>
              {{ t('batchImage.pageNumber', { page: pagination.page }) }}
            </span>
            <span>
              {{ t('batchImage.pageItems', { count: visibleBatchJobs.length }) }}
            </span>
            <div class="flex items-center gap-2">
              <span>{{ t('batchImage.perPage') }}</span>
              <Select
                v-model="pagination.page_size"
                :options="batchPageSizeOptions"
                class="w-24"
                @change="handlePageSizeChange"
              />
            </div>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="pagination.page <= 1 || loadingJobs"
              @click="handlePageChange(pagination.page - 1)"
            >
              <Icon name="chevronLeft" size="sm" class="mr-1" />
              {{ t('batchImage.prevPage') }}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="!pagination.has_more || loadingJobs"
              @click="handlePageChange(pagination.page + 1)"
            >
              {{ t('batchImage.nextPage') }}
              <Icon name="chevronRight" size="sm" class="ml-1" />
            </button>
          </div>
        </div>
      </template>
    </TablePageLayout>

    <Teleport to="body">
      <div
        v-if="openMoreJobId"
        class="fixed z-[9999] w-44 overflow-hidden rounded-xl bg-[color:var(--bx-bg-elevated)] py-1 text-sm shadow-lg ring-1 ring-black/5  dark:ring-white/10"
        :style="moreMenuStyle"
        @click.stop
      >
        <template v-for="job in batchJobs" :key="job.id">
          <template v-if="job.id === openMoreJobId">
            <button
              v-if="canRetry(job)"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-[color:var(--bx-text-soft)] transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60  dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
              :disabled="retryingBatchId === job.id"
              @click="retryFailedJob(job)"
            >
              <Icon name="refresh" size="sm" :class="retryingBatchId === job.id ? 'animate-spin' : ''" />
              {{ t('batchImage.retryFailedItems') }}
            </button>
            <button
              v-if="canDeleteRecord(job)"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
              :disabled="deletingBatchId === job.id"
              @click="deleteJob(job)"
            >
              <Icon :name="deletingBatchId === job.id ? 'refresh' : 'trash'" size="sm" :class="deletingBatchId === job.id ? 'animate-spin' : ''" />
              {{ t('batchImage.deleteRecords') }}
            </button>
          </template>
        </template>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="promptPopover.visible"
        class="batch-prompt-popover fixed z-[9999] rounded-lg border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-elevated)] p-3 text-sm text-gray-800 shadow-xl ring-1 ring-black/5   dark:text-gray-100 dark:ring-white/10"
        :style="promptPopover.style"
        @mouseenter="cancelPromptPopoverClose"
        @mouseleave="schedulePromptPopoverClose"
      >
        <div class="mb-2 flex items-center justify-between gap-3">
          <span class="text-xs font-medium text-[color:var(--bx-text-dim)]">{{ t('batchImage.fullPrompt') }}</span>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:text-primary-300 dark:hover:bg-primary-900/20"
            @click="copyPromptPopover"
          >
            {{ t('batchImage.copy') }}
          </button>
        </div>
        <p class="max-h-48 overflow-y-auto whitespace-pre-wrap break-words leading-6 selection:bg-primary-100 selection:text-primary-900 dark:selection:bg-primary-900/60 dark:selection:text-primary-100">
          {{ promptPopover.text }}
        </p>
      </div>
    </Teleport>

    <BaseDialog :show="!!currentJob" :title="t('batchImage.modalDetailTitle')" width="extra-wide" @close="closeDetail">
      <div v-if="currentJob" class="space-y-4">
        <div class="rounded-lg border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-muted)] px-4 py-3  ">
          <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="min-w-0 text-center">
              <p class="text-xs text-[color:var(--bx-text-dim)]">{{ t('batchImage.status') }}</p>
              <div class="mt-1 flex justify-center">
                <span :class="statusBadgeClass(currentDisplayJob || currentJob)" class="badge whitespace-nowrap">
                  {{ statusLabel(currentDisplayJob || currentJob) }}
                </span>
              </div>
            </div>
            <div class="min-w-0 text-center">
              <p class="text-xs text-[color:var(--bx-text-dim)]">{{ hasChildJobs(currentJob.id) ? t('batchImage.summaryResults') : t('batchImage.results') }}</p>
              <p class="mt-1 flex items-center justify-center gap-2 font-medium tabular-nums">
              <span class="text-emerald-600 dark:text-emerald-300">{{ (currentDisplayJob || currentJob).success_count }}</span>
              <span class="text-gray-300 dark:text-dark-500">/</span>
              <span :class="(currentDisplayJob || currentJob).fail_count > 0 ? 'text-red-600 dark:text-red-300' : 'text-[color:var(--bx-text-dim)]'">{{ (currentDisplayJob || currentJob).fail_count }}</span>
            </p>
            </div>
            <div class="min-w-0 text-center">
              <p class="text-xs text-[color:var(--bx-text-dim)]">{{ t('batchImage.cost') }}</p>
              <p class="mt-1 truncate font-medium text-[color:var(--bx-text)]">{{ costLabel(currentDisplayJob || currentJob) }}</p>
            </div>
            <div class="min-w-0 text-center">
              <p class="text-xs text-[color:var(--bx-text-dim)]">{{ t('batchImage.downloadStatus') }}</p>
              <p class="mt-1 truncate font-medium text-[color:var(--bx-text)]">
              {{ currentJob.downloaded_at ? formatDate(currentJob.downloaded_at) : t('batchImage.notDownloaded') }}
            </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-[color:var(--bx-text)]">{{ t('batchImage.items') }}</h3>
          <button type="button" class="btn btn-secondary btn-sm" :disabled="refreshing || loadingItems" @click="refreshDetail">
            <Icon name="refresh" size="sm" class="mr-1.5" :class="refreshing || loadingItems ? 'animate-spin' : ''" />
            {{ t('batchImage.refresh') }}
          </button>
        </div>

        <div v-if="items.length" class="overflow-x-auto rounded-lg border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-elevated)]">
          <table class="w-full min-w-[860px] table-fixed divide-y divide-gray-200 text-sm dark:divide-dark-700">
            <colgroup>
              <col class="w-[18%]" />
              <col class="w-[34%]" />
              <col class="w-[12%]" />
              <col class="w-[10%]" />
              <col class="w-[26%]" />
            </colgroup>
            <thead class="bg-[color:var(--bx-bg-muted)]">
              <tr>
                <th class="px-3 py-3 text-center text-sm font-medium text-[color:var(--bx-text-dim)]">Custom ID</th>
                <th class="px-3 py-3 text-left text-sm font-medium text-[color:var(--bx-text-dim)]">Prompt</th>
                <th class="px-3 py-3 text-center text-sm font-medium text-[color:var(--bx-text-dim)]">{{ t('batchImage.status') }}</th>
                <th class="px-3 py-3 text-center text-sm font-medium text-[color:var(--bx-text-dim)]">{{ t('batchImage.preview') }}</th>
                <th class="px-3 py-3 text-center text-sm font-medium text-[color:var(--bx-text-dim)]">{{ t('batchImage.results') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-dark-700">
              <tr
                v-for="item in items"
                :key="itemPreviewKey(item)"
                class="align-middle"
                :class="detailItemRowClass(item)"
              >
                <td class="px-3 py-2.5 text-center">
                  <span
                    class="block min-w-0 truncate font-mono text-sm"
                    :class="isRecoveredOriginalFailure(item) ? 'text-[color:var(--bx-text-dim)]' : 'text-[color:var(--bx-text)]'"
                    :title="item.custom_id"
                  >
                    {{ item.custom_id }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-left" :class="isRecoveredOriginalFailure(item) ? 'text-[color:var(--bx-text-dim)]' : 'text-[color:var(--bx-text-soft)]'">
                  <div
                    class="batch-prompt-trigger cursor-default truncate rounded px-1 text-sm leading-6 focus:outline-none"
                    tabindex="0"
                    @pointerenter="schedulePromptPopoverOpen($event, item.prompt_preview || '-')"
                    @pointerleave="schedulePromptPopoverClose"
                    @mouseenter="schedulePromptPopoverOpen($event, item.prompt_preview || '-')"
                    @mouseleave="schedulePromptPopoverClose"
                    @click="showPromptPopover($event, item.prompt_preview || '-')"
                    @focus="showPromptPopover($event, item.prompt_preview || '-')"
                    @focusin="showPromptPopover($event, item.prompt_preview || '-')"
                    @blur="schedulePromptPopoverClose"
                  >
                    {{ item.prompt_preview || '-' }}
                  </div>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <span :class="itemDisplayStatusBadgeClass(item)" class="badge max-w-full truncate whitespace-nowrap" :title="itemDisplayStatusLabel(item)">
                    {{ itemDisplayStatusLabel(item) }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <div class="mx-auto h-12 w-12 overflow-hidden rounded-md border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-muted)]  ">
                    <button
                      v-if="itemPreviewUrls[itemPreviewKey(item)] && !previewErrorIds.has(itemPreviewKey(item))"
                      type="button"
                      class="block h-full w-full overflow-hidden"
                      :title="t('batchImage.zoomPreview', { id: item.custom_id })"
                      @click="openImagePreview(item)"
                    >
                      <img
                        :src="itemPreviewUrls[itemPreviewKey(item)]"
                        class="h-full w-full object-cover"
                        alt=""
                        @error="handlePreviewError(itemPreviewKey(item))"
                      />
                    </button>
                    <button
                      v-else-if="canLoadItemPreview(item)"
                      type="button"
                      class="flex h-full w-full items-center justify-center text-[color:var(--bx-text-dim)] transition-colors hover:bg-[color:var(--bx-hover)] hover:text-primary-600 disabled:cursor-wait disabled:opacity-70  "
                      :disabled="previewLoadingIds.has(itemPreviewKey(item))"
                      :title="previewErrorIds.has(itemPreviewKey(item)) ? t('batchImage.reloadCompressedPreview') : t('batchImage.loadCompressedPreview')"
                      @click="loadItemPreview(item)"
                    >
                      <Icon :name="previewLoadingIds.has(itemPreviewKey(item)) ? 'refresh' : 'eye'" size="sm" :class="previewLoadingIds.has(itemPreviewKey(item)) ? 'animate-spin' : ''" />
                    </button>
                    <div v-else class="flex h-full w-full items-center justify-center text-gray-400" :title="item.image_count > 0 ? t('batchImage.cannotPreview') : t('batchImage.noImage')">
                      <Icon name="document" size="sm" />
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <span
                    class="inline-flex max-w-full items-center justify-center truncate rounded-md px-2.5 py-1 text-xs font-medium leading-5 ring-1 ring-inset"
                    :class="itemResultClass(item)"
                    :title="itemResultLabel(item)"
                  >
                    {{ itemResultLabel(item) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-lg border border-dashed border-[color:var(--bx-border)] py-10 text-center ">
          <Icon name="refresh" size="lg" class="mx-auto mb-3 text-gray-400" :class="loadingItems ? 'animate-spin' : ''" />
          <p class="text-sm font-medium text-[color:var(--bx-text-soft)]">
            {{ loadingItems ? t('batchImage.loadingItems') : t('batchImage.noItems') }}
          </p>
          <p v-if="!loadingItems" class="mt-1 text-sm text-[color:var(--bx-text-dim)]">
            {{ t('batchImage.itemsHint') }}
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
	          <button type="button" class="btn btn-secondary" :disabled="!currentJob || !canCancel(currentJob) || cancelling" @click="cancelSelected">
	            <Icon v-if="cancelling" name="refresh" size="sm" class="mr-2 animate-spin" />
	            {{ t('batchImage.cancelJob') }}
	          </button>
	          <button
	            v-if="currentJob && currentDisplayJob && canRetry(currentDisplayJob)"
	            type="button"
	            class="btn btn-secondary inline-flex min-w-[116px] items-center justify-center"
	            :disabled="retryingBatchId === currentJob.id"
	            @click="retrySelected"
	          >
	            <Icon name="refresh" size="sm" class="mr-2" :class="currentJob && retryingBatchId === currentJob.id ? 'animate-spin' : ''" />
	            {{ t('batchImage.retryFailedItems') }}
	          </button>
	          <button
            type="button"
            class="btn btn-primary inline-flex min-w-[112px] items-center justify-center"
            :disabled="!currentJob || !canDownload(currentJob) || downloading"
            @click="downloadSelected"
          >
            <Icon
              :name="currentJob && isDownloadingJob(currentJob.id) ? 'refresh' : 'download'"
              size="sm"
              class="mr-2"
              :class="currentJob && isDownloadingJob(currentJob.id) ? 'animate-spin' : ''"
            />
            {{ t('batchImage.downloadZip') }}
          </button>
        </div>
      </template>
    </BaseDialog>

    <BaseDialog :show="!!previewImageItem" :title="previewImageItem?.custom_id || t('batchImage.imagePreview')" width="extra-wide" :z-index="60" @close="closeImagePreview">
      <div class="space-y-3">
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {{ t('batchImage.previewCacheHint') }}
        </div>
        <div class="flex min-h-[420px] items-center justify-center rounded-lg bg-[color:var(--bx-bg-muted)] p-4 ">
          <img
            v-if="previewImageUrl"
            :src="previewImageUrl"
            class="max-h-[70vh] max-w-full rounded-md object-contain"
            :alt="previewImageItem?.custom_id || ''"
          />
        </div>
      </div>
    </BaseDialog>

    <BaseDialog :show="showCreateModal" :title="t('batchImage.modalCreateTitle')" width="wide" @close="closeCreateModal">
      <form class="space-y-5" @submit.prevent="submitJob">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="input-label">{{ t('batchImage.taskName') }}</label>
            <input
              v-model="form.taskName"
              type="text"
              maxlength="255"
              class="input"
              :placeholder="t('batchImage.taskNamePlaceholder')"
            />
          </div>

          <div class="md:col-span-2">
            <label class="input-label">API Key</label>
            <select v-model.number="form.apiKeyId" class="input" :disabled="loadingKeys">
              <option :value="0">{{ loadingKeys ? t('batchImage.loadingKeys') : t('batchImage.selectGeminiKey') }}</option>
              <option v-for="key in geminiApiKeys" :key="key.id" :value="key.id">
                {{ key.name }} · {{ key.group?.name || 'Gemini' }}
              </option>
            </select>
            <p v-if="!loadingKeys && geminiApiKeys.length === 0" class="input-hint text-amber-600 dark:text-amber-400">
              {{ t('batchImage.noGeminiKeyHint') }}
            </p>
          </div>

          <div>
            <label class="input-label">{{ t('batchImage.model') }}</label>
            <select v-model="form.model" class="input" :disabled="loadingModels || availableBatchImageModels.length === 0">
              <option v-if="loadingModels" value="">{{ t('batchImage.loadingModels') }}</option>
              <option v-else-if="availableBatchImageModels.length === 0" value="">{{ t('batchImage.noModels') }}</option>
              <option v-for="model in availableBatchImageModels" :key="model.value" :value="model.value">
                {{ model.label }}
              </option>
            </select>
            <p v-if="modelLoadError" class="input-hint text-amber-600 dark:text-amber-400">
              {{ modelLoadError }}
            </p>
            <p v-else-if="selectedApiKey && !loadingModels && availableBatchImageModels.length === 0" class="input-hint text-amber-600 dark:text-amber-400">
              {{ t('batchImage.noModelsHint') }}
            </p>
          </div>

          <div>
            <label class="input-label">{{ t('batchImage.imageSize') }}</label>
            <div class="input flex items-center bg-[color:var(--bx-bg-muted)] text-[color:var(--bx-text-muted)]  ">
              1K
            </div>
            <p class="input-hint">{{ t('batchImage.imageSizeHint') }}</p>
          </div>

          <div>
            <label class="input-label">{{ t('batchImage.outputFormat') }}</label>
            <select v-model="form.responseMimeType" class="input">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>

          <div>
            <label class="input-label">{{ t('batchImage.estimatedOutput') }}</label>
            <div class="input flex items-center bg-[color:var(--bx-bg-muted)] text-[color:var(--bx-text-muted)]  ">
              {{ t('batchImage.estimatedOutputValue', { images: estimatedOutputCount, prompts: promptRows.length }) }}
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <label class="input-label mb-0">Prompt</label>
            <span class="text-xs text-[color:var(--bx-text-dim)]">{{ t('batchImage.promptsAdded', { count: promptRows.length }) }}</span>
          </div>
          <div class="rounded-lg border border-[color:var(--bx-border)] p-3 ">
            <textarea
              v-model="promptDraft"
              rows="3"
              class="h-[76px] w-full resize-y rounded-md border border-[color:var(--bx-border)] px-3 py-2 text-sm leading-5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100  dark:bg-dark-900 dark:text-gray-100 dark:focus:border-primary-500 dark:focus:ring-primary-900/40"
              :placeholder="t('batchImage.promptPlaceholder')"
            />
            <div class="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_112px_132px_112px] md:items-center">
              <input
                v-model="customIdDraft"
                type="text"
                maxlength="255"
                class="input h-9 text-sm"
                :placeholder="t('batchImage.customIdOptional')"
              />
              <select
                v-model.number="outputCountDraft"
                class="batch-output-count-select input h-9 text-sm"
                :title="t('batchImage.outputsPerPrompt')"
                :aria-label="t('batchImage.outputsPerPrompt')"
              >
                <option v-for="count in outputCountOptions" :key="count" :value="count">
                  {{ t('batchImage.outputsCount', { count }) }}
                </option>
              </select>
              <label
                class="btn btn-secondary h-9 cursor-pointer justify-center text-sm"
                :class="referenceImageDrafts.length >= selectedModelReferenceLimit ? 'pointer-events-none opacity-60' : ''"
              >
                <Icon name="upload" size="sm" class="mr-1.5" />
                {{ t('batchImage.referenceImages') }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  class="hidden"
                  :disabled="referenceImageDrafts.length >= selectedModelReferenceLimit"
                  @change="handleReferenceImageFiles"
                />
              </label>
              <button type="button" class="btn btn-secondary h-9 justify-center whitespace-nowrap px-4 text-sm" :disabled="!promptDraft.trim()" @click="addPromptRow">
                <Icon name="plus" size="sm" class="mr-1.5" />
                {{ t('batchImage.add') }}
              </button>
            </div>
            <div v-if="referenceImageDrafts.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="(ref, refIndex) in referenceImageDrafts"
                :key="`${ref.name}-${refIndex}`"
                class="inline-flex max-w-full items-center gap-1 rounded-md border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-muted)] px-2 py-1 text-xs text-[color:var(--bx-text-soft)]   "
              >
                <span class="max-w-[180px] truncate">{{ ref.name }}</span>
                <button type="button" class="text-gray-400 hover:text-red-600" :title="t('batchImage.removeReference')" @click="removeReferenceImageDraft(refIndex)">
                  <Icon name="x" size="xs" />
                </button>
              </span>
            </div>
            <p class="mt-2 text-xs text-[color:var(--bx-text-dim)]">
              {{ t('batchImage.referenceLimitsHint', { maxPerItem: BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM, maxPerJob: BATCH_IMAGE_MAX_OUTPUTS_PER_JOB, modelLimit: selectedModelReferenceLimit }) }}</p>
          </div>
          <div v-if="promptRows.length" class="overflow-hidden rounded-lg border border-[color:var(--bx-border)]">
            <div
              v-for="(row, index) in promptRows"
              :key="row.localId"
              class="flex items-center gap-3 border-b border-[color:var(--bx-border)] px-3 py-2 last:border-b-0 "
            >
              <span class="w-20 flex-shrink-0 font-mono text-xs text-[color:var(--bx-text-dim)]">{{ row.custom_id }}</span>
              <p class="min-w-0 flex-1 truncate text-sm text-[color:var(--bx-text)]">{{ row.prompt }}</p>
              <span v-if="row.output_count > 1" class="flex-shrink-0 text-xs text-[color:var(--bx-text-dim)]">
                x{{ row.output_count }}
              </span>
              <span v-if="row.reference_images.length" class="flex-shrink-0 text-xs text-[color:var(--bx-text-dim)]">
                {{ t('batchImage.referenceCount', { count: row.reference_images.length }) }}
              </span>
              <button type="button" class="btn-ghost btn-icon flex-shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" :title="t('batchImage.delete')" @click="removePromptRow(index)">
                <Icon name="trash" size="sm" />
              </button>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-[color:var(--bx-border)] px-3 py-6 text-center text-sm text-[color:var(--bx-text-dim)]  ">
            {{ t('batchImage.noPromptsYet') }}
          </div>
        </div>

	        <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
	          {{ t('batchImage.cancelBillingHint') }}
	        </div>
	        <div v-if="submitting" class="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
	          {{ t('batchImage.submittingHint') }}
	        </div>
	      </form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn btn-secondary" :disabled="submitting" @click="closeCreateModal">{{ t('batchImage.cancel') }}</button>
	          <button type="button" class="btn btn-primary inline-flex min-w-[120px] justify-center" :disabled="submitting || loadingModels || (parsedItems.length === 0 && !promptDraft.trim()) || !selectedApiKey || !form.model" @click="submitJob">
            <Icon v-if="submitting" name="refresh" size="sm" class="mr-2 animate-spin" />
            {{ submitting ? t('batchImage.submitting') : t('batchImage.submitJob') }}
          </button>
        </div>
      </template>
    </BaseDialog>

    <BaseDialog :show="showGuideModal" :title="t('batchImage.modalGuideTitle')" width="wide" @close="showGuideModal = false">
	      <div class="space-y-5">
	        <section class="space-y-3">
	          <h3 class="text-sm font-semibold text-[color:var(--bx-text)]">{{ t('batchImage.guideUiTitle') }}</h3>
	          <div class="rounded-lg border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-muted)] p-3 text-sm leading-6 text-[color:var(--bx-text-soft)]   ">
	            <!-- BOXAI: Keep all four guide steps in the locale bundle. -->
	            <p>{{ t('batchImage.guideUi1') }}</p>
	            <p>{{ t('batchImage.guideUi2') }}</p>
	            <p>{{ t('batchImage.guideUi3') }}</p>
	            <p>{{ t('batchImage.guideUi4') }}</p>
	          </div>
	        </section>
	        <section class="space-y-3">
	          <div class="flex flex-wrap items-center justify-between gap-3">
	            <h3 class="text-sm font-semibold text-[color:var(--bx-text)]">{{ t('batchImage.guideSkillTitle') }}</h3>
	            <p class="text-xs text-[color:var(--bx-text-dim)]">{{ t('batchImage.guideSkillHint') }}</p>
	          </div>
	        <textarea
	          :value="agentInstruction"
	          readonly
	          class="min-h-[420px] w-full resize-y rounded-md border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-muted)] p-4 font-mono text-sm leading-6 text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100   dark:text-gray-100 dark:focus:border-primary-500 dark:focus:ring-primary-900/40"
	        />
	        </section>
	      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn btn-secondary" @click="showGuideModal = false">{{ t('batchImage.close') }}</button>
          <button type="button" class="btn btn-primary" @click="copyInstruction">
            <Icon name="copy" size="sm" class="mr-2" />
            {{ t('batchImage.copyGuide') }}
          </button>
        </div>
      </template>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import TablePageLayout from '@/components/layout/TablePageLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import Icon from '@/components/icons/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'
import { getPersistedPageSize, setPersistedPageSize } from '@/composables/usePersistedPageSize'
import { useAppStore } from '@/stores/app'
import { keysAPI } from '@/api'
import {
  cancelBatchImageJob,
  deleteBatchImageJobRecord,
  downloadBatchImageZip,
  getBatchImageItemContent,
  getBatchImageJob,
  listBatchImageJobs,
  listBatchImageItems,
  listBatchImageModels,
  saveBlob,
  submitBatchImageJob,
  type BatchImageItem,
  type BatchImageJob,
  type BatchImageJobsListOptions,
  type BatchImageReferenceImage,
  type BatchImageStatus,
  type BatchImageSubmitItem,
} from '@/api/batchImage'
import type { ApiKey } from '@/types'
import type { Column } from '@/components/common/types'

type BatchImageJobRow = Pick<BatchImageJob, 'id' | 'task_name' | 'parent_batch_id' | 'status' | 'model' | 'provider' | 'item_count' | 'success_count' | 'fail_count' | 'estimated_cost' | 'hold_amount' | 'actual_cost' | 'created_at' | 'downloaded_at'> & {
  api_key_id: number
  api_key_name: string
  child_count: number
  is_child?: boolean
}

type BatchImageDetailItem = BatchImageItem & {
  batch_id: string
  source_task_name: string
}

type PromptRow = {
  localId: string
  custom_id: string
  prompt: string
  output_count: number
  reference_images: BatchImageReferenceImage[]
}

type ReferenceImageDraft = BatchImageReferenceImage & {
  name: string
  size: number
}

type PreviewCacheRecord = {
  key: string
  blob: Blob
  size: number
  createdAt: number
  lastAccessedAt: number
}

type PreviewImageSource = ImageBitmap | HTMLImageElement

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'output_deleted'])
const PREVIEW_CACHE_DB_NAME = 'sub2api-batch-image-preview-cache'
const PREVIEW_CACHE_STORE_NAME = 'thumbnails'
const PREVIEW_THUMBNAIL_MAX_EDGE = 360
const PREVIEW_THUMBNAIL_QUALITY = 0.72
const PREVIEW_CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const PREVIEW_CACHE_MAX_ENTRIES = 120
const PREVIEW_CACHE_MAX_BYTES = 48 * 1024 * 1024
const BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM = 4
const BATCH_IMAGE_MAX_OUTPUTS_PER_JOB = 200
const outputCountOptions = Array.from({ length: BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM }, (_, index) => index + 1)
const batchPageSizeOptions: SelectOption[] = [20, 50, 100].map(size => ({ value: size, label: String(size) }))

const appStore = useAppStore()
const { copyToClipboard } = useClipboard()
const { t, locale } = useI18n()

const columns: Column[] = [
  { key: 'select', label: '', sortable: false, class: 'w-12 text-center' },
  { key: 'id', label: t('batchImage.colTaskName'), sortable: false, class: 'w-[240px] max-w-[240px]' },
  { key: 'model', label: t('batchImage.colModel'), sortable: false, class: 'w-[180px] max-w-[180px] text-center' },
  { key: 'api_key_name', label: t('batchImage.colSubmitKey'), sortable: false, class: 'w-40 max-w-40 text-center' },
  { key: 'status', label: t('batchImage.colStatus'), sortable: false, class: 'w-28 text-center' },
  { key: 'counts', label: t('batchImage.colResults'), sortable: false, class: 'w-32 text-center' },
  { key: 'cost', label: t('batchImage.colCost'), sortable: false, class: 'w-36 text-center' },
  { key: 'downloaded', label: t('batchImage.colDownloadStatus'), sortable: false, class: 'w-40 text-center' },
  { key: 'actions', label: t('batchImage.colActions'), sortable: false, class: 'w-40 text-center' },
]

const statusFilterOptions: SelectOption[] = [
  { value: '', label: t('batchImage.statusAll') },
  { value: 'queued', label: t('batchImage.statusQueued') },
  { value: 'running', label: t('batchImage.statusRunning') },
  { value: 'processing_results', label: t('batchImage.statusProcessingResults') },
  { value: 'settling', label: t('batchImage.statusSettling') },
  { value: 'completed', label: t('batchImage.statusCompleted') },
  { value: 'failed', label: t('batchImage.statusFailed') },
  { value: 'cancelled', label: t('batchImage.statusCancelled') },
  { value: 'output_deleted', label: t('batchImage.statusOutputDeleted') },
]

const downloadFilterOptions: SelectOption[] = [
  { value: '', label: t('batchImage.downloadAll') },
  { value: 'true', label: t('batchImage.downloadYes') },
  { value: 'false', label: t('batchImage.downloadNo') },
]

const form = reactive({
  apiKeyId: 0,
  taskName: '',
  model: '',
  responseMimeType: 'image/png',
})

const filters = reactive({
  taskName: '',
  apiKeyId: '',
  status: '',
  downloaded: '',
})

const pagination = reactive({
  page: 1,
  page_size: Math.min(getPersistedPageSize(20), 100),
  has_more: false,
})

const apiKeys = ref<ApiKey[]>([])
const loadingKeys = ref(false)
const loadingJobs = ref(false)
const submitting = ref(false)
const refreshing = ref(false)
const cancelling = ref(false)
const downloading = ref(false)
const downloadingBatchId = ref('')
const retryingBatchId = ref('')
const bulkDownloading = ref(false)
const bulkDeleting = ref(false)
const deletingBatchId = ref('')
const loadingItems = ref(false)
const loadingModels = ref(false)
const showCreateModal = ref(false)
const showGuideModal = ref(false)
const currentJob = ref<BatchImageJob | null>(null)
const selectedBatchId = ref('')
const selectedBatchApiKeyId = ref(0)
const items = ref<BatchImageDetailItem[]>([])
const batchJobs = ref<BatchImageJobRow[]>([])
const selectedJobIds = ref(new Set<string>())
const expandedParentIds = ref(new Set<string>())
const promptRows = ref<PromptRow[]>([])
const promptDraft = ref('')
const customIdDraft = ref('')
const outputCountDraft = ref(1)
const referenceImageDrafts = ref<ReferenceImageDraft[]>([])
const itemPreviewUrls = reactive<Record<string, string>>({})
const previewLoadingIds = ref(new Set<string>())
const previewErrorIds = ref(new Set<string>())
const previewImageItem = ref<BatchImageItem | null>(null)
const availableBatchImageModels = ref<Array<{ value: string; label: string }>>([])
const modelLoadError = ref('')
const openMoreJobId = ref('')
const moreMenuStyle = ref<Record<string, string>>({})
const promptPopover = reactive({
  visible: false,
  text: '',
  style: {} as Record<string, string>,
})
let modelRequestSeq = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let previewCacheDBPromise: Promise<IDBDatabase | null> | null = null
let previewCacheCleanupTimer: ReturnType<typeof setInterval> | null = null
let promptPopoverCloseTimer: ReturnType<typeof setTimeout> | null = null
let promptPopoverOpenTimer: ReturnType<typeof setTimeout> | null = null
let activePromptPopoverTarget: HTMLElement | null = null

const geminiApiKeys = computed(() =>
  apiKeys.value.filter((key) =>
    key.status === 'active' &&
    key.group?.platform === 'gemini' &&
    key.group?.allow_batch_image_generation === true,
  ),
)

const selectedApiKey = computed(() =>
  geminiApiKeys.value.find((key) => key.id === Number(form.apiKeyId)) || null,
)

const filteredApiKeys = computed(() => {
  const selectedFilterID = Number(filters.apiKeyId || 0)
  if (!selectedFilterID) return geminiApiKeys.value
  return geminiApiKeys.value.filter(key => key.id === selectedFilterID)
})

const apiKeyFilterOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('batchImage.apiKeyAll') },
  ...geminiApiKeys.value.map(key => ({
    value: String(key.id),
    label: key.name || `API Key #${key.id}`,
  })),
])

const selectedRows = computed(() =>
  batchJobs.value.filter(job => selectedJobIds.value.has(job.id)),
)

const childrenByParent = computed(() => {
  const groups = new Map<string, BatchImageJobRow[]>()
  for (const job of batchJobs.value) {
    if (!job.parent_batch_id) continue
    const rows = groups.get(job.parent_batch_id) || []
    rows.push(job)
    groups.set(job.parent_batch_id, rows)
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.created_at - b.created_at)
  }
  return groups
})

const visibleBatchJobs = computed(() => {
  const rows: BatchImageJobRow[] = []
  for (const job of batchJobs.value.filter(item => !item.parent_batch_id)) {
    rows.push(job)
    if (expandedParentIds.value.has(job.id)) {
      rows.push(...(childrenByParent.value.get(job.id) || []).map(child => ({ ...child, is_child: true })))
    }
  }
  return rows
})

const selectedDownloadableRows = computed(() =>
  selectedRows.value.filter(job => canDownload(job)),
)

const allVisibleSelected = computed(() =>
  visibleBatchJobs.value.length > 0 && visibleBatchJobs.value.every(job => selectedJobIds.value.has(job.id)),
)

const someVisibleSelected = computed(() =>
  visibleBatchJobs.value.some(job => selectedJobIds.value.has(job.id)) && !allVisibleSelected.value,
)

const previewImageUrl = computed(() => {
  const item = previewImageItem.value
  if (!item) return ''
  return itemPreviewUrls[itemPreviewKey(item)] || ''
})

const recoveredOriginalCustomIds = computed(() => {
  const rootBatchId = detailRootBatchId()
  if (!rootBatchId) return new Set<string>()
  const ids = new Set<string>()
  for (const item of items.value) {
    if (!isChildDetailItem(item) || !isSuccessfulImageItem(item)) continue
    const sourceCustomID = retrySourceCustomID(item.custom_id)
    if (sourceCustomID) ids.add(sourceCustomID)
  }
  return ids
})

const currentDisplayJob = computed(() => {
  if (!currentJob.value) return null
  return displayJob(currentJob.value)
})

const endpointBase = computed(() => {
  const configured = appStore.apiBaseUrl?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '')
  return t('batchImage.endpointPlaceholder')
})

const selectedModelReferenceLimit = computed(() => referenceImageLimitForModel(form.model))

const estimatedOutputCount = computed(() =>
  promptRows.value.reduce((sum, row) => sum + normalizeOutputCount(row.output_count), 0),
)

const parsedItems = computed<BatchImageSubmitItem[]>(() => {
  const used = new Set<string>()
  return promptRows.value
    .map((row, index) => {
      const customID = uniqueCustomID(row.custom_id || `img_${String(index + 1).padStart(3, '0')}`, used, index)
      const item: BatchImageSubmitItem = { custom_id: customID, prompt: row.prompt.trim() }
      const outputCount = normalizeOutputCount(row.output_count)
      if (outputCount > 1) {
        item.output_count = outputCount
      }
      if (row.reference_images.length) {
        item.reference_images = row.reference_images
      }
      return item
    })
    .filter(item => item.prompt)
})

function referenceImageLimitForModel(model: string) {
  const normalized = String(model || '').toLowerCase()
  if (normalized.includes('pro-image')) return 14
  if (normalized.includes('flash-image')) return 3
  return 0
}

// BOXAI: The downloadable Agent Skill follows the full zh/en/vi product locale set.
const agentInstruction = computed(() => {
  const base = endpointBase.value
  if (getLocale() === 'zh') {
    return `---
name: sub2api-batch-image
description: 当用户希望用 Gemini/Vertex 批量生成图片、批量跑提示词、下载批量生图结果、重试失败图片时使用。
---

你是 Codex 中的批量生图执行 Agent。用户不需要手动填写页面表单；你应从当前聊天、用户给的文件、目录或上下文中整理任务名称、prompt 列表和输出目录，只有缺少关键决策时才向用户提问。

默认端点：
${base}

你需要自己完成：
1. 从用户聊天或附件中提取 prompt。每条 prompt 保留完整文本，按顺序生成稳定 custom_id，例如 img_001、img_002。
2. 从用户要求或上下文推断任务名称；没有明确名称时用当前时间生成任务名。
3. 从用户要求或上下文推断输出目录；如果用户没有说保存到哪里，才询问用户。
4. 提交前必须先计算 expected_output_count = 所有 item 的 output_count 之和。单个批量任务硬性最多 200 张输出图；超过 200 张必须拆成多组任务。
5. 参考图是输入附件不是输出数量；Flash Image 每条最多 3 张参考图，Pro Image 每条最多 14 张。
6. 选择 API Key/模型后调用批量生图 API 提交、轮询、下载。
7. 不要把 API Key 或参考图 base64 写入仓库或公开回复。
8. 完成后报告任务名、id、成功/失败数、扣费与保存路径。`
  }
  if (getLocale().startsWith('vi')) {
    return `---
name: sub2api-batch-image
description: Dùng khi người dùng muốn tạo ảnh hàng loạt bằng Gemini/Vertex, chạy hàng loạt prompt, tải kết quả hoặc thử lại ảnh bị lỗi.
---

Bạn là agent tạo ảnh hàng loạt trong Codex. Không yêu cầu người dùng điền biểu mẫu web; hãy lấy tên tác vụ, danh sách prompt và thư mục đầu ra từ cuộc trò chuyện hoặc tệp. Chỉ hỏi khi thiếu một quyết định quan trọng.

Endpoint mặc định:
${base}

Bạn phải:
1. Trích xuất prompt và tạo custom_id ổn định theo thứ tự (img_001, img_002, …).
2. Suy ra tên tác vụ; nếu không có tên rõ ràng, dùng thời gian hiện tại.
3. Suy ra thư mục đầu ra; chỉ hỏi người dùng khi không có thông tin này.
4. Tính expected_output_count trước khi gửi. Mỗi tác vụ tối đa 200 ảnh đầu ra; chia thành nhiều tác vụ nếu vượt giới hạn.
5. Ảnh tham chiếu là đầu vào, không tính vào số ảnh đầu ra (Flash Image tối đa 3 ảnh/mục, Pro Image tối đa 14 ảnh/mục).
6. Chọn API Key và mô hình, sau đó gọi API tạo ảnh hàng loạt để gửi, thăm dò trạng thái và tải kết quả.
7. Không ghi API Key hoặc base64 của ảnh tham chiếu vào kho mã hay câu trả lời công khai.
8. Khi hoàn tất, báo cáo tên và ID tác vụ, số mục thành công/thất bại, chi phí và đường dẫn lưu.`
  }
  return `---
name: sub2api-batch-image
description: Use when the user wants Gemini/Vertex batch image generation, bulk prompts, download, or retry failed images.
---

You are the batch-image agent in Codex. Do not ask the user to fill the web form; gather task name, prompts, and output directory from chat/files; only ask when a critical decision is missing.

Default endpoint:
${base}

You must:
1. Extract prompts and stable custom_id values (img_001, …).
2. Infer task name (or use current time).
3. Infer output directory (ask only if missing).
4. Cap expected_output_count at 200 images per job; split larger jobs.
5. Reference images are inputs (Flash Image ≤3/item, Pro Image ≤14/item).
6. Call batch image APIs to submit, poll, and download.
7. Never put API keys or reference base64 into the repo or public replies.
8. Report task name, id, success/fail counts, cost, and save path when done.`
})

// endpoint path helper reserved for agent instruction / API URL composition
function _joinEndpointPath(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
void _joinEndpointPath

function uniqueCustomID(raw: string, used: Set<string>, index: number): string {
  const base = raw.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || `img_${String(index + 1).padStart(3, '0')}`
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

function normalizeOutputCount(value: unknown): number {
  const parsed = Math.floor(Number(value || 1))
  if (!Number.isFinite(parsed)) return 1
  return Math.min(BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM, Math.max(1, parsed))
}

function addPromptRow() {
  const prompt = promptDraft.value.trim()
  if (!prompt) return
  const outputCount = normalizeOutputCount(outputCountDraft.value)
  const used = new Set(promptRows.value.map(row => row.custom_id))
  const customID = uniqueCustomID(customIdDraft.value || `img_${String(promptRows.value.length + 1).padStart(3, '0')}`, used, promptRows.value.length)
  promptRows.value = [
    ...promptRows.value,
    {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      custom_id: customID,
      prompt,
      output_count: outputCount,
      reference_images: referenceImageDrafts.value.map(({ name: _name, size: _size, ...ref }) => ref),
    },
  ]
  promptDraft.value = ''
  customIdDraft.value = ''
  outputCountDraft.value = 1
  referenceImageDrafts.value = []
}

function removePromptRow(index: number) {
  promptRows.value = promptRows.value.filter((_, currentIndex) => currentIndex !== index)
}

function removeReferenceImageDraft(index: number) {
  referenceImageDrafts.value = referenceImageDrafts.value.filter((_, currentIndex) => currentIndex !== index)
}

async function handleReferenceImageFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (files.length === 0) return
  const limit = selectedModelReferenceLimit.value
  if (limit <= 0) {
    appStore.showError(t('batchImage.refNotSupported'))
    return
  }
  const slots = Math.max(0, limit - referenceImageDrafts.value.length)
  if (slots <= 0) {
    appStore.showError(t('batchImage.refLimit', { limit }))
    return
  }
  const accepted = files.slice(0, slots)
  if (accepted.length < files.length) {
    appStore.showError(t('batchImage.refLimitIgnored', { limit }))
  }
  const next: ReferenceImageDraft[] = []
  for (const file of accepted) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      appStore.showError(t('batchImage.refTypeInvalid'))
      continue
    }
    if (file.size > 10 * 1024 * 1024) {
      appStore.showError(t('batchImage.refTooLarge', { name: file.name }))
      continue
    }
    const data = await readFileAsBase64(file)
    next.push({
      id: file.name,
      type: 'reference',
      mime_type: file.type,
      data,
      name: file.name,
      size: file.size,
    })
  }
  referenceImageDrafts.value = [...referenceImageDrafts.value, ...next]
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

async function loadApiKeys() {
  loadingKeys.value = true
  try {
    const response = await keysAPI.list(1, 100, { status: 'active', sort_by: 'created_at', sort_order: 'desc' })
    apiKeys.value = response.items || []
    if (!selectedApiKey.value && geminiApiKeys.value.length > 0) {
      form.apiKeyId = geminiApiKeys.value[0].id
    }
    if (filters.apiKeyId && !geminiApiKeys.value.some(key => String(key.id) === filters.apiKeyId)) {
      filters.apiKeyId = ''
    }
    if (!selectedApiKey.value) {
      availableBatchImageModels.value = []
      form.model = ''
    }
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.loadKeysFailed')))
  } finally {
    loadingKeys.value = false
  }
}

async function loadAvailableModels() {
  const key = selectedApiKey.value
  const requestID = ++modelRequestSeq
  modelLoadError.value = ''
  availableBatchImageModels.value = []
  form.model = ''
  if (!key) return

  loadingModels.value = true
  try {
    const result = await listBatchImageModels(key.key)
    if (requestID !== modelRequestSeq) return
    const seen = new Set<string>()
    availableBatchImageModels.value = (result.data || [])
      .map(model => String(model.id || '').trim())
      .filter((model) => {
        if (!model || seen.has(model)) return false
        seen.add(model)
        return true
      })
      .map(model => ({ value: model, label: model }))
    form.model = availableBatchImageModels.value[0]?.value || ''
  } catch (error: any) {
    if (requestID !== modelRequestSeq) return
    modelLoadError.value = batchImageErrorMessage(error, t('batchImage.loadModelsFailed'))
  } finally {
    if (requestID === modelRequestSeq) {
      loadingModels.value = false
    }
  }
}

async function refreshPage() {
  await loadApiKeys()
  await loadBatchJobs()
}

function applyFilters() {
  pagination.page = 1
  selectedJobIds.value = new Set()
  void loadBatchJobs()
}

function resetFilters() {
  filters.taskName = ''
  filters.apiKeyId = ''
  filters.status = ''
  filters.downloaded = ''
  applyFilters()
}

function listOptions(): BatchImageJobsListOptions {
  const options: BatchImageJobsListOptions = {
    limit: pagination.page_size,
    cursor: String((pagination.page - 1) * pagination.page_size),
  }
  if (filters.taskName.trim()) options.taskName = filters.taskName.trim()
  if (filters.status) options.status = filters.status
  if (filters.downloaded) options.downloaded = filters.downloaded
  return options
}

function toJobRow(job: BatchImageJob, key = selectedApiKey.value): BatchImageJobRow {
  return {
    id: job.id,
    task_name: job.task_name || defaultTaskName(job.created_at),
    parent_batch_id: job.parent_batch_id || null,
    status: job.status,
    model: job.model,
    provider: job.provider,
    item_count: job.item_count,
    success_count: job.success_count,
    fail_count: job.fail_count,
    estimated_cost: job.estimated_cost,
    hold_amount: job.hold_amount,
    actual_cost: job.actual_cost,
    created_at: job.created_at,
    downloaded_at: job.downloaded_at,
    api_key_id: key?.id || 0,
    api_key_name: key?.name || '',
    child_count: 0,
  }
}

function applyChildCounts(rows: BatchImageJobRow[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.parent_batch_id) continue
    counts.set(row.parent_batch_id, (counts.get(row.parent_batch_id) || 0) + 1)
  }
  return rows.map(row => ({ ...row, child_count: counts.get(row.id) || 0 }))
}

function displayJob<T extends Pick<BatchImageJob, 'id' | 'parent_batch_id' | 'status' | 'item_count' | 'success_count' | 'fail_count' | 'estimated_cost' | 'hold_amount' | 'actual_cost'>>(job: T): T {
  if (job.parent_batch_id) return job
  const children = childrenByParent.value.get(job.id) || []
  if (!children.length) return job

  const childSuccess = children.reduce((sum, child) => sum + child.success_count, 0)
  const childEstimated = children.reduce((sum, child) => sum + child.estimated_cost, 0)
  const childHold = children.reduce((sum, child) => sum + child.hold_amount, 0)
  const childActual = children.reduce((sum, child) => sum + (child.actual_cost || 0), 0)
  const childActualReady = children.every(child => child.actual_cost !== null)
  const successCount = Math.min(job.item_count, job.success_count + childSuccess)
  const failCount = Math.max(0, job.item_count - successCount)
  const actualCost = job.actual_cost === null
    ? (childActualReady ? childActual : null)
    : job.actual_cost + childActual

  return {
    ...job,
    success_count: successCount,
    fail_count: failCount,
    status: failCount === 0 && TERMINAL_STATUSES.has(job.status) ? 'completed' : job.status,
    estimated_cost: job.estimated_cost + childEstimated,
    hold_amount: job.hold_amount + childHold,
    actual_cost: actualCost,
  }
}

function hasChildJobs(batchId: string) {
  return (childrenByParent.value.get(batchId) || []).length > 0
}

function toggleChildRows(batchId: string) {
  const next = new Set(expandedParentIds.value)
  if (next.has(batchId)) next.delete(batchId)
  else next.add(batchId)
  expandedParentIds.value = next
}

function closeMoreMenu() {
  openMoreJobId.value = ''
}

function toggleMoreMenu(job: BatchImageJobRow, event: MouseEvent) {
  if (openMoreJobId.value === job.id) {
    closeMoreMenu()
    return
  }
  const trigger = event.currentTarget as HTMLElement | null
  const rect = trigger?.getBoundingClientRect()
  if (!rect) return
  const menuWidth = 176
  const margin = 8
  const left = Math.max(margin, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin))
  const top = Math.min(rect.bottom + margin, window.innerHeight - 96)
  moreMenuStyle.value = {
    left: `${left}px`,
    top: `${Math.max(margin, top)}px`,
  }
  openMoreJobId.value = job.id
}

function cancelPromptPopoverClose() {
  if (!promptPopoverCloseTimer) return
  clearTimeout(promptPopoverCloseTimer)
  promptPopoverCloseTimer = null
}

function cancelPromptPopoverOpen() {
  if (!promptPopoverOpenTimer) return
  clearTimeout(promptPopoverOpenTimer)
  promptPopoverOpenTimer = null
}

function closePromptPopover() {
  cancelPromptPopoverOpen()
  cancelPromptPopoverClose()
  promptPopover.visible = false
  promptPopover.text = ''
  promptPopover.style = {}
  activePromptPopoverTarget = null
}

function schedulePromptPopoverClose() {
  cancelPromptPopoverOpen()
  cancelPromptPopoverClose()
  promptPopoverCloseTimer = setTimeout(() => {
    closePromptPopover()
  }, 180)
}

function schedulePromptPopoverOpen(event: MouseEvent | PointerEvent, text: string) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const value = String(text || '').trim()
  if (!value || value === '-') return
  activePromptPopoverTarget = target
  cancelPromptPopoverOpen()
  cancelPromptPopoverClose()
  promptPopoverOpenTimer = setTimeout(() => {
    if (activePromptPopoverTarget !== target || !document.body.contains(target)) return
    openPromptPopover(target, value)
  }, 520)
}

function showPromptPopover(event: MouseEvent | FocusEvent, text: string) {
  const value = String(text || '').trim()
  if (!value || value === '-') return
  const target = event.currentTarget as HTMLElement | null
  cancelPromptPopoverClose()
  cancelPromptPopoverOpen()
  if (!target) return
  activePromptPopoverTarget = target
  openPromptPopover(target, value)
}

function openPromptPopover(target: HTMLElement, value: string) {
  const rect = target.getBoundingClientRect()
  if (!rect) return
  const viewportWidth = window.innerWidth || 1280
  const viewportHeight = window.innerHeight || 720
  const width = Math.min(440, Math.max(320, viewportWidth - 32))
  const left = Math.max(16, Math.min(rect.left, viewportWidth - width - 16))
  const estimatedHeight = 178
  const preferredTop = rect.bottom + 8
  const top = preferredTop + estimatedHeight > viewportHeight
    ? Math.max(16, rect.top - estimatedHeight - 8)
    : preferredTop
  promptPopover.text = value
  promptPopover.style = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
  }
  promptPopover.visible = true
}

function copyPromptPopover() {
  if (!promptPopover.text) return
  void copyToClipboard(promptPopover.text, t('batchImage.promptCopied'))
}

async function loadBatchJobs() {
  const keys = filteredApiKeys.value
  if (!keys.length) {
    batchJobs.value = []
    pagination.has_more = false
    return
  }
  loadingJobs.value = true
  closeMoreMenu()
  try {
    const options = listOptions()
    const results = await Promise.all(keys.map(async (key) => {
      const result = await listBatchImageJobs(key.key, options)
      return {
        hasMore: Boolean(result.has_more),
        rows: (result.data || []).map(job => toJobRow(job, key)),
      }
    }))
    batchJobs.value = applyChildCounts(results
      .flatMap(result => result.rows)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, pagination.page_size))
    pagination.has_more = results.some(result => result.hasMore)
    selectedJobIds.value = new Set([...selectedJobIds.value].filter(id => visibleBatchJobs.value.some(job => job.id === id)))
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.loadJobsFailed')))
  } finally {
    loadingJobs.value = false
  }
}

function upsertJob(job: BatchImageJob) {
  const next = toJobRow(job)
  const index = batchJobs.value.findIndex(item => item.id === job.id)
  if (index >= 0) {
    const rows = [...batchJobs.value]
    rows[index] = { ...next, is_child: rows[index].is_child }
    batchJobs.value = applyChildCounts(rows)
    return
  }
  batchJobs.value = applyChildCounts([next, ...batchJobs.value].slice(0, pagination.page_size))
}

function handlePageChange(page: number) {
  if (page < 1 || page === pagination.page) return
  pagination.page = page
  selectedJobIds.value = new Set()
  void loadBatchJobs()
}

function handlePageSizeChange(value: string | number | boolean | null) {
  if (value === null || typeof value === 'boolean') return
  const nextSize = Math.min(Math.max(Number(value) || 20, 1), 100)
  pagination.page_size = nextSize
  pagination.page = 1
  setPersistedPageSize(nextSize)
  selectedJobIds.value = new Set()
  void loadBatchJobs()
}

function openCreateModal() {
  showCreateModal.value = true
  if (!apiKeys.value.length) {
    void loadApiKeys()
  }
}

function closeCreateModal() {
  if (submitting.value) return
  showCreateModal.value = false
  resetCreateDraft()
}

function resetCreateDraft() {
  form.taskName = ''
  form.responseMimeType = 'image/png'
  promptRows.value = []
  promptDraft.value = ''
  customIdDraft.value = ''
  outputCountDraft.value = 1
  referenceImageDrafts.value = []
}

function closeDetail() {
  closePromptPopover()
  currentJob.value = null
  selectedBatchId.value = ''
  selectedBatchApiKeyId.value = 0
  items.value = []
  clearItemPreviews()
}

function keyForSelectedBatch(): ApiKey | null {
  if (selectedBatchApiKeyId.value) {
    const key = geminiApiKeys.value.find(item => item.id === selectedBatchApiKeyId.value)
    if (key) return key
  }
  return selectedApiKey.value
}

function requireApiKey(): ApiKey | null {
  if (!selectedApiKey.value) {
    appStore.showError(t('batchImage.selectApiKey'))
    return null
  }
  return selectedApiKey.value
}

function validateForm(): boolean {
  if (!requireApiKey()) return false
  if (!form.model) {
    appStore.showError(availableBatchImageModels.value.length === 0 ? t('batchImage.noModelsForKey') : t('batchImage.selectModel'))
    return false
  }
  if (parsedItems.value.length === 0) {
    appStore.showError(t('batchImage.promptRequired'))
    return false
  }
  if (estimatedOutputCount.value > BATCH_IMAGE_MAX_OUTPUTS_PER_JOB) {
    appStore.showError(t('batchImage.tooManyOutputImages'))
    return false
  }
  const refLimit = selectedModelReferenceLimit.value
  if (promptRows.value.some(row => row.reference_images.length > refLimit)) {
    appStore.showError(t('batchImage.tooManyReferenceImages'))
    return false
  }
  return true
}

async function submitJob() {
  if (submitting.value) return
  if (promptDraft.value.trim()) addPromptRow()
  if (!validateForm()) return
  const key = requireApiKey()
  if (!key) return
	  submitting.value = true
	  try {
	    const job = await submitBatchImageJob(
	      key.key,
	      {
	        model: form.model,
        task_name: form.taskName.trim() || defaultTaskName(),
        image_size: '1K',
        response_mime_type: form.responseMimeType,
        items: parsedItems.value,
	      },
	      `sub2api-ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
	    )
	    currentJob.value = job
	    selectedBatchId.value = job.id
	    selectedBatchApiKeyId.value = key.id
	    items.value = []
	    upsertJob(job)
	    showCreateModal.value = false
	    resetCreateDraft()
	    appStore.showSuccess(t('batchImage.submitted'))
	    void loadItems()
	    startPolling()
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.submitFailed')))
  } finally {
    submitting.value = false
  }
}

async function refreshSelected() {
  if (!selectedBatchId.value) return
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  refreshing.value = true
  try {
    const job = await getBatchImageJob(key.key, selectedBatchId.value)
    currentJob.value = job
    upsertJob(job)
    if (TERMINAL_STATUSES.has(job.status)) stopPolling()
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.refreshFailed')))
  } finally {
    refreshing.value = false
  }
}

async function refreshDetail() {
  await Promise.all([
    refreshSelected(),
    loadItems(),
  ])
}

function selectJob(batchId: string) {
  const row = batchJobs.value.find(job => job.id === batchId)
  if (row?.api_key_id && geminiApiKeys.value.some(key => key.id === row.api_key_id)) {
    form.apiKeyId = row.api_key_id
    selectedBatchApiKeyId.value = row.api_key_id
  } else {
    selectedBatchApiKeyId.value = 0
  }
  selectedBatchId.value = batchId
  currentJob.value = null
  items.value = []
  void refreshSelected()
  void loadItems()
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!currentJob.value || TERMINAL_STATUSES.has(currentJob.value.status)) {
      stopPolling()
      return
    }
    void refreshSelected()
  }, 8000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function canCancel(job: Pick<BatchImageJob, 'status'>) {
  return !TERMINAL_STATUSES.has(job.status)
}

function canDownload(job: Pick<BatchImageJob, 'status' | 'success_count'>) {
  return job.status === 'completed' && job.success_count > 0
}

function canRetry(job: Pick<BatchImageJob, 'status' | 'fail_count'>) {
  const display = 'id' in job ? displayJob(job as BatchImageJob) : job
  return TERMINAL_STATUSES.has(display.status) && display.fail_count > 0
}

function isDownloadingJob(batchId: string) {
  return downloading.value && downloadingBatchId.value === batchId
}

function applyJobApiKey(job: BatchImageJobRow | Pick<BatchImageJob, 'id'>) {
  if ('api_key_id' in job && job.api_key_id && geminiApiKeys.value.some(key => key.id === job.api_key_id)) {
    form.apiKeyId = job.api_key_id
  }
}

function apiKeyForJob(job: BatchImageJobRow | Pick<BatchImageJob, 'id'>): ApiKey | null {
  if ('api_key_id' in job && job.api_key_id) {
    return geminiApiKeys.value.find(key => key.id === job.api_key_id) || null
  }
  return selectedApiKey.value
}

function toggleJobSelection(batchId: string, checked: boolean) {
  const next = new Set(selectedJobIds.value)
  if (checked) next.add(batchId)
  else next.delete(batchId)
  selectedJobIds.value = next
}

function toggleAllVisible(checked: boolean) {
  const next = new Set(selectedJobIds.value)
  for (const job of visibleBatchJobs.value) {
    if (checked) next.add(job.id)
    else next.delete(job.id)
  }
  selectedJobIds.value = next
}

function canDeleteRecord(job: Pick<BatchImageJob, 'status'>) {
  return TERMINAL_STATUSES.has(job.status)
}

async function cancelSelected() {
  if (!currentJob.value) return
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  if (!window.confirm(t('batchImage.cancelConfirm'))) return
  cancelling.value = true
  try {
    const job = await cancelBatchImageJob(key.key, currentJob.value.id)
    currentJob.value = job
    upsertJob(job)
    appStore.showSuccess(t('batchImage.cancelled'))
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.cancelFailed')))
  } finally {
    cancelling.value = false
  }
}

async function downloadSelected() {
  if (!currentJob.value) return
  await downloadJob(currentJob.value)
}

async function retrySelected() {
  if (!currentJob.value) return
  await retryFailedJob(currentJob.value)
}

async function retryFailedJob(job: BatchImageJobRow | BatchImageJob) {
  if (!canRetry(job) || retryingBatchId.value) return
  closeMoreMenu()
  const key = apiKeyForJob(job) || keyForSelectedBatch() || requireApiKey()
  if (!key) return
  retryingBatchId.value = job.id
  try {
    const sourceItems = await ensureItemsForRetry(key.key, job.id)
    const failedItems = sourceItems
      .filter(item => item.status === 'failed')
      .map(item => ({ custom_id: retryCustomID(item.custom_id), prompt: String(item.prompt_preview || '').trim() }))
      .filter(item => item.prompt)
    if (failedItems.length === 0) {
      appStore.showError(t('batchImage.retryMissingPrompts'))
      return
    }
    const retryJob = await submitBatchImageJob(
      key.key,
      {
        model: job.model,
        task_name: `${job.task_name || defaultTaskName()} ${t('batchImage.retryTaskSuffix')}`,
        parent_batch_id: rootBatchIdForRetry(job),
        provider: job.provider,
        image_size: '1K',
        response_mime_type: form.responseMimeType,
        items: failedItems,
      },
      `sub2api-ui-retry-${job.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    )
    currentJob.value = retryJob
    selectedBatchId.value = retryJob.id
    selectedBatchApiKeyId.value = key.id
    items.value = []
    upsertJob(retryJob)
    if (retryJob.parent_batch_id) {
      expandedParentIds.value = new Set([...expandedParentIds.value, retryJob.parent_batch_id])
    }
    appStore.showSuccess(t('batchImage.retrySubmitted'))
    void loadItems()
    startPolling()
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.retryFailed')))
  } finally {
    retryingBatchId.value = ''
  }
}

async function ensureItemsForRetry(apiKey: string, batchId: string) {
  if (selectedBatchId.value === batchId && items.value.length > 0) {
    return items.value
  }
  const result = await listBatchImageItems(apiKey, batchId)
  return result.data || []
}

function retryCustomID(customID: string) {
  const base = String(customID || 'item').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
  return `${base}_retry_${Date.now().toString(36)}`
}

function rootBatchIdForRetry(job: BatchImageJobRow | BatchImageJob) {
  return job.parent_batch_id || job.id
}

async function downloadJob(job: (BatchImageJobRow | Pick<BatchImageJob, 'id'>)) {
  if (downloading.value) return
  closeMoreMenu()
  applyJobApiKey(job)
  const key = apiKeyForJob(job) || requireApiKey()
  if (!key) return
  downloading.value = true
  downloadingBatchId.value = job.id
  try {
    const blob = await downloadBatchImageZip(key.key, job.id)
    saveBlob(blob, `${job.id}.zip`)
    markJobDownloaded(job.id)
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.downloadFailed')))
  } finally {
    downloading.value = false
    downloadingBatchId.value = ''
  }
}

async function downloadSelectedJobs() {
  if (bulkDownloading.value || selectedDownloadableRows.value.length === 0) return
  bulkDownloading.value = true
  try {
    for (const row of selectedDownloadableRows.value) {
      const key = apiKeyForJob(row)
      if (!key) continue
      downloading.value = true
      downloadingBatchId.value = row.id
      const blob = await downloadBatchImageZip(key.key, row.id)
      saveBlob(blob, `${row.id}.zip`)
      markJobDownloaded(row.id)
    }
    appStore.showSuccess(t('batchImage.batchDownloadStarted'))
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.downloadFailed')))
  } finally {
    bulkDownloading.value = false
    downloading.value = false
    downloadingBatchId.value = ''
  }
}

async function deleteJob(job: BatchImageJobRow) {
  if (!canDeleteRecord(job) || deletingBatchId.value) return
  closeMoreMenu()
  const key = apiKeyForJob(job)
  if (!key) return
  if (!window.confirm(t('batchImage.deleteConfirm'))) return
  deletingBatchId.value = job.id
  try {
    await deleteBatchImageJobRecord(key.key, job.id)
    removeJobFromList(job.id)
    appStore.showSuccess(t('batchImage.deleted'))
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.deleteFailed')))
  } finally {
    deletingBatchId.value = ''
  }
}

async function deleteSelectedJobs() {
  const rows = selectedRows.value.filter(job => canDeleteRecord(job))
  if (bulkDeleting.value || rows.length === 0) return
  if (!window.confirm(t('batchImage.deleteSelectedConfirm'))) return
  bulkDeleting.value = true
  try {
    for (const row of rows) {
      const key = apiKeyForJob(row)
      if (!key) continue
      deletingBatchId.value = row.id
      await deleteBatchImageJobRecord(key.key, row.id)
      removeJobFromList(row.id)
    }
    appStore.showSuccess(t('batchImage.deleted'))
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.deleteFailed')))
  } finally {
    bulkDeleting.value = false
    deletingBatchId.value = ''
  }
}

function markJobDownloaded(batchId: string) {
  const downloadedAt = Math.floor(Date.now() / 1000)
  batchJobs.value = batchJobs.value.map(job => job.id === batchId ? { ...job, downloaded_at: job.downloaded_at || downloadedAt } : job)
  if (currentJob.value?.id === batchId && !currentJob.value.downloaded_at) {
    currentJob.value = { ...currentJob.value, downloaded_at: downloadedAt }
  }
}

function removeJobFromList(batchId: string) {
  batchJobs.value = batchJobs.value.filter(job => job.id !== batchId)
  toggleJobSelection(batchId, false)
  if (currentJob.value?.id === batchId) closeDetail()
}

function canLoadItemPreview(item: BatchImageItem) {
  return (item.status === 'succeeded' || item.status === 'success') && item.image_count > 0
}

function isSuccessfulImageItem(item: Pick<BatchImageItem, 'status' | 'image_count'>) {
  return (item.status === 'succeeded' || item.status === 'success') && item.image_count > 0
}

function detailRootBatchId() {
  return currentJob.value?.parent_batch_id || selectedBatchId.value || currentJob.value?.id || ''
}

function isChildDetailItem(item: Pick<BatchImageDetailItem, 'batch_id'>) {
  const rootBatchId = detailRootBatchId()
  return Boolean(rootBatchId && item.batch_id && item.batch_id !== rootBatchId)
}

function retrySourceCustomID(customID: string) {
  return String(customID || '').replace(/(?:_retry_[a-z0-9]+)+$/i, '')
}

function isRecoveredOriginalFailure(item: BatchImageDetailItem) {
  const rootBatchId = detailRootBatchId()
  return Boolean(
    rootBatchId
    && item.batch_id === rootBatchId
    && item.status === 'failed'
    && recoveredOriginalCustomIds.value.has(item.custom_id),
  )
}

function detailItemRowClass(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) {
    return 'bg-[color:var(--bx-bg-muted)] text-gray-400 hover:bg-[color:var(--bx-hover)]  dark:text-gray-500 '
  }
  return 'hover:bg-[color:var(--bx-hover)] '
}

function previewCacheSupported() {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function previewCacheKey(batchId: string, customID: string, imageIndex = 0) {
  return [batchId, customID, imageIndex].map(part => encodeURIComponent(String(part))).join(':')
}

function itemPreviewKey(item: Pick<BatchImageItem, 'batch_id' | 'custom_id'>) {
  return previewCacheKey(item.batch_id || selectedBatchId.value || currentJob.value?.id || '', item.custom_id, 0)
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openPreviewCacheDB(): Promise<IDBDatabase | null> {
  if (!previewCacheSupported()) return Promise.resolve(null)
  if (previewCacheDBPromise) return previewCacheDBPromise

  previewCacheDBPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(PREVIEW_CACHE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PREVIEW_CACHE_STORE_NAME)) {
        const store = db.createObjectStore(PREVIEW_CACHE_STORE_NAME, { keyPath: 'key' })
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return previewCacheDBPromise
}

async function getCachedPreviewBlob(cacheKey: string): Promise<Blob | null> {
  const db = await openPreviewCacheDB()
  if (!db) return null
  const record = await idbRequest<PreviewCacheRecord | undefined>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).get(cacheKey),
  ).catch(() => undefined)
  if (!record?.blob) return null

  const now = Date.now()
  if (now - record.createdAt > PREVIEW_CACHE_MAX_AGE_MS) {
    void deleteCachedPreview(cacheKey)
    return null
  }
  void touchCachedPreview(cacheKey, now)
  return record.blob
}

async function hydrateCachedItemPreviews(detailItems: BatchImageDetailItem[]) {
  const previewableItems = detailItems.filter(item => canLoadItemPreview(item))
  if (!previewableItems.length || !previewCacheSupported()) return

  await Promise.all(previewableItems.map(async (item) => {
    const batchId = item.batch_id || selectedBatchId.value || currentJob.value?.id || ''
    const previewKey = itemPreviewKey(item)
    if (!batchId || itemPreviewUrls[previewKey] || previewErrorIds.value.has(previewKey)) return
    const cached = await getCachedPreviewBlob(previewCacheKey(batchId, item.custom_id, 0)).catch(() => null)
    if (!cached || itemPreviewUrls[previewKey]) return
    itemPreviewUrls[previewKey] = URL.createObjectURL(cached)
  }))
}

async function putCachedPreviewBlob(cacheKey: string, blob: Blob) {
  const db = await openPreviewCacheDB()
  if (!db) return
  const now = Date.now()
  const record: PreviewCacheRecord = {
    key: cacheKey,
    blob,
    size: blob.size,
    createdAt: now,
    lastAccessedAt: now,
  }
  await idbRequest(db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME).put(record)).catch(() => null)
  void cleanupPreviewCache()
}

async function touchCachedPreview(cacheKey: string, lastAccessedAt: number) {
  const db = await openPreviewCacheDB()
  if (!db) return
  const record = await idbRequest<PreviewCacheRecord | undefined>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).get(cacheKey),
  ).catch(() => undefined)
  if (!record) return
  record.lastAccessedAt = lastAccessedAt
  await idbRequest(db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME).put(record)).catch(() => null)
}

async function deleteCachedPreview(cacheKey: string) {
  const db = await openPreviewCacheDB()
  if (!db) return
  await idbRequest(db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME).delete(cacheKey)).catch(() => null)
}

async function cleanupPreviewCache() {
  const db = await openPreviewCacheDB()
  if (!db) return
  const records = await idbRequest<PreviewCacheRecord[]>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).getAll(),
  ).catch(() => [])
  if (!records.length) return

  const now = Date.now()
  const sorted = [...records].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
  const deleteKeys = new Set<string>()
  let totalBytes = 0
  let keptCount = 0

  for (const record of sorted) {
    if (now - record.createdAt > PREVIEW_CACHE_MAX_AGE_MS) {
      deleteKeys.add(record.key)
      continue
    }
    totalBytes += record.size || record.blob?.size || 0
    keptCount += 1
  }

  for (const record of sorted) {
    if (deleteKeys.has(record.key)) continue
    if (keptCount <= PREVIEW_CACHE_MAX_ENTRIES && totalBytes <= PREVIEW_CACHE_MAX_BYTES) break
    deleteKeys.add(record.key)
    totalBytes -= record.size || record.blob?.size || 0
    keptCount -= 1
  }

  if (!deleteKeys.size) return
  const store = db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME)
  for (const key of deleteKeys) {
    store.delete(key)
  }
}

async function createThumbnailBlob(blob: Blob): Promise<Blob> {
  const source = await loadPreviewImageSource(blob)
  const width = source.width
  const height = source.height
  const scale = Math.min(1, PREVIEW_THUMBNAIL_MAX_EDGE / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(source.image, 0, 0, targetWidth, targetHeight)
  source.close()
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((thumbnail) => {
      if (thumbnail) resolve(thumbnail)
      else reject(new Error('thumbnail unavailable'))
    }, 'image/webp', PREVIEW_THUMBNAIL_QUALITY)
  })
}

async function loadPreviewImageSource(blob: Blob): Promise<{ image: PreviewImageSource, width: number, height: number, close: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await window.createImageBitmap(blob)
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image unavailable'))
      img.src = url
    })
    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

async function loadItems() {
  const batchId = selectedBatchId.value || currentJob.value?.id || ''
  if (!batchId) return
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  loadingItems.value = true
  try {
    clearItemPreviews()
    const jobs = detailJobsForBatch(batchId)
    const results = await Promise.all(jobs.map(async (job) => {
      const result = await listBatchImageItems(key.key, job.id)
      return (result.data || []).map(item => ({
        ...item,
        batch_id: job.id,
        source_task_name: detailSourceName(job, batchId),
      }))
    }))
    const detailItems = results.flat()
    items.value = detailItems
    void hydrateCachedItemPreviews(detailItems)
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, t('batchImage.loadItemsFailed')))
  } finally {
    loadingItems.value = false
  }
}

function detailJobsForBatch(batchId: string): BatchImageJobRow[] {
  const row = batchJobs.value.find(job => job.id === batchId)
  const base = row || (currentJob.value && currentJob.value.id === batchId ? toJobRow(currentJob.value, keyForSelectedBatch() || selectedApiKey.value) : null)
  if (!base) return []
  if (base.parent_batch_id) return [base]
  return [base, ...(childrenByParent.value.get(base.id) || [])]
}

function detailSourceName(job: Pick<BatchImageJobRow, 'id' | 'task_name' | 'parent_batch_id'>, rootBatchId: string) {
  const name = job.task_name || job.id
  if (job.id === rootBatchId) return t('batchImage.mainTask', { name })
  return t('batchImage.childTask', { name })
}

async function loadItemPreview(item: BatchImageItem) {
  const batchId = item.batch_id || selectedBatchId.value || currentJob.value?.id || ''
  const previewKey = itemPreviewKey(item)
  if (!batchId || !canLoadItemPreview(item) || (itemPreviewUrls[previewKey] && !previewErrorIds.value.has(previewKey))) return
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  const cacheKey = previewCacheKey(batchId, item.custom_id, 0)
  previewLoadingIds.value = new Set([...previewLoadingIds.value, previewKey])
  try {
    previewErrorIds.value = new Set([...previewErrorIds.value].filter(id => id !== previewKey))
    if (itemPreviewUrls[previewKey]) {
      URL.revokeObjectURL(itemPreviewUrls[previewKey])
      delete itemPreviewUrls[previewKey]
    }
    const cached = await getCachedPreviewBlob(cacheKey)
    if (cached) {
      itemPreviewUrls[previewKey] = URL.createObjectURL(cached)
      return
    }
    const blob = await getBatchImageItemContent(key.key, batchId, item.custom_id, 0)
    const thumbnail = await createThumbnailBlob(blob).catch(() => blob)
    itemPreviewUrls[previewKey] = URL.createObjectURL(thumbnail)
    if (thumbnail !== blob || thumbnail.size <= 1024 * 1024) {
      void putCachedPreviewBlob(cacheKey, thumbnail)
    }
  } catch (error: any) {
    previewErrorIds.value = new Set([...previewErrorIds.value, previewKey])
    appStore.showError(batchImageErrorMessage(error, t('batchImage.loadPreviewFailed')))
  } finally {
    const next = new Set(previewLoadingIds.value)
    next.delete(previewKey)
    previewLoadingIds.value = next
  }
}

function openImagePreview(item: BatchImageItem) {
  const previewKey = itemPreviewKey(item)
  if (!itemPreviewUrls[previewKey] || previewErrorIds.value.has(previewKey)) return
  previewImageItem.value = item
}

function closeImagePreview() {
  previewImageItem.value = null
}

function handlePreviewError(customID: string) {
  if (itemPreviewUrls[customID]) {
    URL.revokeObjectURL(itemPreviewUrls[customID])
    delete itemPreviewUrls[customID]
  }
  previewErrorIds.value = new Set([...previewErrorIds.value, customID])
}

function clearItemPreviews() {
  closePromptPopover()
  for (const url of Object.values(itemPreviewUrls)) {
    if (url) URL.revokeObjectURL(url)
  }
  for (const key of Object.keys(itemPreviewUrls)) {
    delete itemPreviewUrls[key]
  }
  previewLoadingIds.value = new Set()
  previewErrorIds.value = new Set()
  previewImageItem.value = null
}

function copyInstruction() {
  void copyToClipboard(agentInstruction.value, t('batchImage.copiedInstruction'))
}

function statusLabel(jobOrStatus: BatchImageStatus | Pick<BatchImageJob, 'status' | 'success_count' | 'fail_count'>) {
  const status = typeof jobOrStatus === 'string' ? jobOrStatus : jobOrStatus.status
  if (typeof jobOrStatus !== 'string' && status === 'completed' && jobOrStatus.fail_count > 0) {
    if (jobOrStatus.success_count > 0) return t('batchImage.partialSuccess')
    return t('batchImage.allFailed')
  }
  const labels: Record<string, string> = {
    queued: t('batchImage.statusQueued'),
    running: t('batchImage.statusRunning'),
    indexing: t('batchImage.statusIndexing'),
    processing_results: t('batchImage.statusProcessingResults'),
    settling: t('batchImage.statusSettling'),
    completed: t('batchImage.statusCompleted'),
    failed: t('batchImage.statusFailed'),
    cancelled: t('batchImage.statusCancelled'),
    output_deleted: t('batchImage.statusOutputDeleted'),
  }
  return labels[status] || status
}

function statusBadgeClass(jobOrStatus: BatchImageStatus | Pick<BatchImageJob, 'status' | 'success_count' | 'fail_count'>) {
  const status = typeof jobOrStatus === 'string' ? jobOrStatus : jobOrStatus.status
  if (typeof jobOrStatus !== 'string' && status === 'completed' && jobOrStatus.fail_count > 0) {
    if (jobOrStatus.success_count > 0) return 'badge-warning'
    return 'badge-danger'
  }
  if (status === 'completed') return 'badge-success'
  if (status === 'failed' || status === 'cancelled') return 'badge-danger'
  if (status === 'output_deleted') return 'badge-gray'
  return 'badge-primary'
}

function itemStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: t('batchImage.itemPending'),
    succeeded: t('batchImage.itemSucceeded'),
    success: t('batchImage.itemSucceeded'),
    failed: t('batchImage.statusFailed'),
    cancelled: t('batchImage.statusCancelled'),
  }
  return labels[status] || status
}

function itemDisplayStatusLabel(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) return t('batchImage.recoveredSuccess')
  return itemStatusLabel(item.status)
}

function itemStatusBadgeClass(status: string) {
  if (status === 'succeeded' || status === 'success') return 'badge-success'
  if (status === 'failed' || status === 'cancelled') return 'badge-danger'
  return 'badge-primary'
}

function itemDisplayStatusBadgeClass(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) return 'badge-gray'
  return itemStatusBadgeClass(item.status)
}

function itemResultLabel(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) return t('batchImage.recoveredHint')
  if (item.error) return friendlyItemError(item.error)
  if (item.status === 'succeeded' || item.status === 'success') {
    return itemPreviewUrls[itemPreviewKey(item)] ? t('batchImage.imageReadyPreview') : t('batchImage.imageReadyDownload')
  }
  if (item.status === 'failed') return t('batchImage.noUsableImage')
  if (item.status === 'cancelled') return t('batchImage.jobCancelled')
  return t('batchImage.waitingResult')
}

function itemResultClass(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) return 'bg-[color:var(--bx-bg-muted)] text-[color:var(--bx-text-dim)] ring-gray-200   dark:ring-dark-700'
  if (item.error || item.status === 'failed' || item.status === 'cancelled') return 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/50'
  if (item.status === 'succeeded' || item.status === 'success') return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50'
  return 'bg-[color:var(--bx-bg-muted)] text-[color:var(--bx-text-dim)] ring-gray-200   dark:ring-dark-700'
}

function friendlyItemError(error: BatchImageItem['error']) {
  if (!error) return '-'
  if (error.code === 'EMPTY_IMAGE_OUTPUT') return t('batchImage.itemErrorEmpty')
  if (error.code === 'PROVIDER_ITEM_FAILED') return t('batchImage.itemErrorProvider')
  return error.message || error.code || '-'
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '$0.00'
  return `$${Number(value).toFixed(2)}`
}

function terminalZeroCost(job: Pick<BatchImageJob, 'status' | 'actual_cost'>) {
  return job.actual_cost === null && (job.status === 'failed' || job.status === 'cancelled')
}

function costLabel(job: Pick<BatchImageJob, 'status' | 'hold_amount' | 'actual_cost'>) {
  if (job.actual_cost !== null) return formatMoney(job.actual_cost)
  if (terminalZeroCost(job)) return formatMoney(0)
  return t('batchImage.holdAmount', { amount: formatMoney(job.hold_amount) })
}

function batchImageMsg(key: string, params?: Record<string, unknown>) {
  return params ? t(`batchImage.${key}`, params) : t(`batchImage.${key}`)
}
void batchImageMsg

function getLocale(): string {
  return String(locale.value || 'en').toLowerCase()
}

function isZhLocale(): boolean {
  return getLocale().startsWith('zh')
}

function isViLocale(): boolean {
  return getLocale().startsWith('vi')
}

function batchImageErrorReference(error: any): string {
  const parts: string[] = []
  const code = String(error?.code || '').trim()
  const requestId = String(error?.requestId || error?.request_id || '').trim()
  const status = String(error?.status || '').trim()
  if (code) parts.push(isZhLocale() ? `错误码：${code}` : isViLocale() ? `mã lỗi: ${code}` : `code: ${code}`)
  if (requestId) parts.push(isZhLocale() ? `请求 ID：${requestId}` : isViLocale() ? `ID yêu cầu: ${requestId}` : `request ID: ${requestId}`)
  if (!code && status) parts.push(isZhLocale() ? `HTTP 状态：${status}` : isViLocale() ? `trạng thái HTTP: ${status}` : `HTTP status: ${status}`)
  return parts.length ? `（${parts.join('，')}）` : ''
}

function batchImageAdminError(base: string, error: any): string {
  const reference = batchImageErrorReference(error)
  const adminHint = t('batchImage.adminReference')
  return `${base}${reference ? ` ${reference}` : ''} ${adminHint}`
}

function batchImagePlainError(base: string): string {
  return base
}

function batchImageErrorMessage(error: any, fallback: string) {
  const code = String(error?.code || '').trim()
  const message = String(error?.message || '').trim()
  if (code === 'API_KEY_REQUIRED' || code === '401') {
    return batchImagePlainError(t('batchImage.authRequired'))
  }
  if (code === 'BATCH_IMAGE_NO_ACCOUNT_AVAILABLE' || /no compatible batch image account/i.test(message)) {
    return batchImageAdminError(t('batchImage.noCompatibleAccount'), error)
  }
  if (code === 'BATCH_IMAGE_UNSUPPORTED_PROVIDER' || /unsupported batch image provider/i.test(message)) {
    return batchImageAdminError(t('batchImage.unsupportedProvider'), error)
  }
  if (code === 'BATCH_IMAGE_VERTEX_GCS_BUCKET_MISSING' || code === 'VERTEX_MANAGED_GCS_BUCKET_MISSING') {
    return batchImageAdminError(t('batchImage.vertexGcsBucketMissing'), error)
  }
  if (
    code === 'BATCH_IMAGE_PROVIDER_SUBMIT_FAILED' ||
    code === 'BATCH_IMAGE_PROVIDER_MISSING_API_KEY' ||
    code === 'BATCH_IMAGE_PROVIDER_MISSING_SERVICE_ACCOUNT' ||
    code === 'BATCH_IMAGE_PROVIDER_UNSUPPORTED_ACCOUNT'
  ) {
    return batchImageAdminError(t('batchImage.providerSubmitFailed'), error)
  }
  if (code === 'BATCH_IMAGE_QUEUE_FAILED' || code === 'BATCH_IMAGE_QUEUE_NOT_CONFIGURED') {
    return batchImageAdminError(t('batchImage.queueFailed'), error)
  }
  if (code === 'BATCH_IMAGE_BILLING_HOLD_FAILED') {
    return batchImageAdminError(t('batchImage.billingHoldFailed'), error)
  }
  if (code === 'BATCH_IMAGE_GROUP_DISABLED') {
    return batchImagePlainError(t('batchImage.groupDisabled'))
  }
  if (code === 'BATCH_IMAGE_SETTLEMENT_PRICING_MISSING') {
    return batchImageAdminError(t('batchImage.pricingMissing'), error)
  }
  if (code === 'BATCH_IMAGE_INSUFFICIENT_BALANCE') {
    return batchImagePlainError(t('batchImage.insufficientBalance'))
  }
  if (code === 'BATCH_IMAGE_INVALID_MODEL') {
    return t('batchImage.invalidModel')
  }
  if (code === 'BATCH_IMAGE_INVALID_ITEMS') {
    return t('batchImage.invalidItems')
  }
  if (code === 'BATCH_IMAGE_DUPLICATE_CUSTOM_ID') {
    return t('batchImage.duplicateCustomId')
  }
  if (code === 'BATCH_IMAGE_PROMPT_TOO_LONG') {
    return t('batchImage.promptTooLong')
  }
  if (code === 'BATCH_IMAGE_INVALID_REFERENCE_IMAGE') {
    return t('batchImage.invalidReferenceImage')
  }
  if (code === 'BATCH_IMAGE_TOO_MANY_REFERENCE_IMAGES') {
    return t('batchImage.tooManyReferenceImages')
  }
  if (code === 'BATCH_IMAGE_REFERENCE_IMAGES_TOO_LARGE') {
    return t('batchImage.referenceImagesTooLarge')
  }
  if (code === 'BATCH_IMAGE_TOO_MANY_OUTPUT_IMAGES') {
    return t('batchImage.tooManyOutputImages')
  }
  if (code === 'BATCH_IMAGE_IDEMPOTENCY_CONFLICT') {
    return batchImagePlainError(t('batchImage.idempotencyConflict'))
  }
  if (code === 'BATCH_IMAGE_NOT_READY') {
    return t('batchImage.notReady')
  }
  if (code === 'BATCH_IMAGE_OUTPUT_DELETED') {
    return t('batchImage.outputDeleted')
  }
  if (code === 'BATCH_IMAGE_RESULT_MISSING') {
    return batchImageAdminError(t('batchImage.resultMissing'), error)
  }
  if (code === 'BATCH_IMAGE_ITEM_FAILED') {
    return batchImagePlainError(t('batchImage.itemFailed'))
  }
  if (code === 'BATCH_IMAGE_ITEM_IMAGE_INDEX_OUT_OF_RANGE') {
    return batchImagePlainError(t('batchImage.itemImageIndexOutOfRange'))
  }
  if (code === 'BATCH_IMAGE_DOWNLOAD_LIMITED') {
    return t('batchImage.downloadLimited')
  }
  if (code === 'BATCH_IMAGE_DOWNLOAD_TOO_LARGE') {
    return t('batchImage.downloadTooLarge')
  }
  if (code === 'BATCH_IMAGE_RECORD_DELETE_NOT_READY') {
    return batchImagePlainError(t('batchImage.deleteNotReady'))
  }
  if (code === 'BATCH_IMAGE_DISABLED') {
    return batchImageAdminError(t('batchImage.disabled'), error)
  }
  if (code === 'INTERNAL_ERROR' || code === '500') {
    return batchImageAdminError(fallback, error)
  }
  if (isZhLocale()) {
    const detail = message ? `${t('batchImage.errorReference')}：${message}` : t('batchImage.adminReference')
    return `${fallback}。${detail} ${batchImageErrorReference(error)}`
  }
  if (isViLocale()) {
    const detail = message ? `${t('batchImage.errorReference')}: ${message}` : t('batchImage.adminReference')
    return `${fallback}. ${detail} ${batchImageErrorReference(error)}`
  }
  return message || fallback
}

function formatDate(timestamp: number) {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleString()
}

function defaultTaskName(timestamp?: number) {
  const date = timestamp ? new Date(timestamp * 1000) : new Date()
  return date.toLocaleString()
}

onMounted(() => {
  void appStore.fetchPublicSettings()
  void refreshPage()
  void cleanupPreviewCache()
  previewCacheCleanupTimer = setInterval(() => {
    void cleanupPreviewCache()
  }, 60 * 60 * 1000)
  document.addEventListener('click', closeMoreMenu)
  window.addEventListener('resize', closeMoreMenu)
  window.addEventListener('scroll', closeMoreMenu, true)
  window.addEventListener('resize', closePromptPopover)
  window.addEventListener('scroll', closePromptPopover, true)
})

watch(
  () => form.apiKeyId,
  () => {
    void loadAvailableModels()
  },
)

watch(
  () => form.model,
  () => {
    const limit = selectedModelReferenceLimit.value
    if (limit <= 0) {
      referenceImageDrafts.value = []
      return
    }
    if (referenceImageDrafts.value.length > limit) {
      referenceImageDrafts.value = referenceImageDrafts.value.slice(0, limit)
    }
  },
)

onBeforeUnmount(() => {
  stopPolling()
  if (previewCacheCleanupTimer) {
    clearInterval(previewCacheCleanupTimer)
    previewCacheCleanupTimer = null
  }
  clearItemPreviews()
  document.removeEventListener('click', closeMoreMenu)
  window.removeEventListener('resize', closeMoreMenu)
  window.removeEventListener('scroll', closeMoreMenu, true)
  window.removeEventListener('resize', closePromptPopover)
  window.removeEventListener('scroll', closePromptPopover, true)
})
</script>

<style scoped>
.batch-row-action {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 42px;
  line-height: 1;
  outline: none;
}

.batch-row-action:focus {
  outline: none;
}

.batch-row-action :deep(svg) {
  margin-right: 0 !important;
}

.batch-prompt-trigger:focus {
  outline: none;
  box-shadow: none;
}

.batch-prompt-popover {
  user-select: text;
}

.batch-prompt-popover p {
  scrollbar-width: thin;
}

.batch-output-count-select {
  height: 36px;
  min-height: 36px;
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 14px;
  padding-right: 34px;
  line-height: 36px;
}
</style>

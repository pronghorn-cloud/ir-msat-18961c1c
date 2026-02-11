<template>
  <div class="appeal-detail">
    <div v-if="loading" class="loading-state">Loading appeal...</div>

    <div v-else-if="error" class="error-state">
      <goa-callout type="emergency" heading="Error">{{ error }}</goa-callout>
    </div>

    <template v-else-if="appeal">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-row">
          <div>
            <h1>Appeal {{ appeal.file_number }}</h1>
            <p>{{ appeal.settlement_name }} — {{ appeal.issue_type }}</p>
          </div>
          <goa-button type="tertiary" @_click="$router.push('/appeals')">
            Back to Appeals
          </goa-button>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="status-bar">
        <div class="status-item">
          <span class="status-label">Status</span>
          <div v-if="editingStatus" class="inline-edit">
            <select class="inline-select" :value="appeal.status" @change="onStatusChange($event)" @blur="editingStatus = false">
              <option v-for="s in statuses" :key="s.name" :value="s.name">{{ s.name }}</option>
            </select>
          </div>
          <div v-else class="editable-value" @click="startEditStatus">
            <span class="status-badge" :class="'status-' + (appeal.status || '').toLowerCase().replace(/\s+/g, '-')">
              {{ appeal.status }}
            </span>
            <span class="edit-icon" title="Edit status">&#9998;</span>
          </div>
        </div>
        <div class="status-item">
          <span class="status-label">Stage</span>
          <div v-if="editingStage" class="inline-edit">
            <select class="inline-select" :value="appeal.stage" @change="onStageChange($event)" @blur="editingStage = false">
              <option v-for="st in stages" :key="st.code" :value="st.code">{{ st.code }}</option>
            </select>
          </div>
          <div v-else class="editable-value" @click="startEditStage">
            <span class="stage-value">{{ appeal.stage || '—' }}</span>
            <span class="edit-icon" title="Edit stage">&#9998;</span>
          </div>
        </div>
        <div class="status-item">
          <span class="status-label">Contact Date</span>
          <span>{{ formatDate(appeal.contact_date) }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Primary Staff</span>
          <span>{{ appeal.primary_staff || '—' }}</span>
        </div>
      </div>

      <!-- Update feedback -->
      <div v-if="updateMessage" class="update-feedback" :class="updateError ? 'feedback-error' : 'feedback-success'">
        {{ updateMessage }}
      </div>

      <!-- Tab Navigation -->
      <div class="tabs-container">
        <div class="tab-nav">
          <button v-for="tab in tabs" :key="tab.key"
                  class="tab-button"
                  :class="{ active: activeTab === tab.key }"
                  @click="activeTab = tab.key">
            {{ tab.label }}
            <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
          </button>
        </div>

        <div class="tab-content">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="tab-panel">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">File Number</span>
                <span class="info-value file-number">{{ appeal.file_number }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Settlement</span>
                <span class="info-value">{{ appeal.settlement_name || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Issue Type</span>
                <span class="info-value">{{ appeal.issue_type || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Primary Staff</span>
                <span class="info-value">{{ appeal.primary_staff || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Secondary Staff</span>
                <span class="info-value">{{ appeal.secondary_staff || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Contact Date</span>
                <span class="info-value">{{ formatDate(appeal.contact_date) }}</span>
              </div>
              <div class="info-item" v-if="appeal.mediation_date">
                <span class="info-label">Mediation Date</span>
                <span class="info-value">{{ formatDate(appeal.mediation_date) }}</span>
              </div>
              <div class="info-item" v-if="appeal.hearing_date">
                <span class="info-label">Hearing Date</span>
                <span class="info-value">{{ formatDate(appeal.hearing_date) }}</span>
              </div>
              <div class="info-item" v-if="appeal.closed_date">
                <span class="info-label">Closed Date</span>
                <span class="info-value">{{ formatDate(appeal.closed_date) }}</span>
              </div>
              <div class="info-item" v-if="appeal.on_hold_start">
                <span class="info-label">On Hold Start</span>
                <span class="info-value">{{ formatDate(appeal.on_hold_start) }}</span>
              </div>
              <div class="info-item" v-if="appeal.on_hold_end">
                <span class="info-label">On Hold End</span>
                <span class="info-value">{{ formatDate(appeal.on_hold_end) }}</span>
              </div>
            </div>

            <div v-if="appeal.description" class="text-block">
              <span class="info-label">Description</span>
              <p>{{ appeal.description }}</p>
            </div>

            <div v-if="appeal.legal_description" class="text-block">
              <span class="info-label">Legal Description</span>
              <p>{{ appeal.legal_description }}</p>
            </div>

            <div v-if="appeal.background" class="text-block">
              <span class="info-label">Background</span>
              <p>{{ appeal.background }}</p>
            </div>

            <!-- Mediation Section -->
            <div class="mediation-section">
              <h3>Mediation</h3>

              <!-- Schedule Mediation Form -->
              <div class="schedule-mediation-form">
                <div class="mediation-form-grid">
                  <div class="med-field">
                    <label>Date <span class="required">*</span></label>
                    <input type="date" class="panel-input" v-model="mediationForm.hearing_date" />
                  </div>
                  <div class="med-field">
                    <label>Time</label>
                    <input type="time" class="panel-input" v-model="mediationForm.hearing_time" />
                  </div>
                  <div class="med-field">
                    <label>Location</label>
                    <input type="text" class="panel-input" v-model="mediationForm.location" placeholder="e.g. MSAT Board Room" />
                  </div>
                  <div class="med-field">
                    <label>Public</label>
                    <select class="inline-select" v-model="mediationForm.is_public">
                      <option :value="true">Yes</option>
                      <option :value="false">No</option>
                    </select>
                  </div>
                  <div class="med-field med-notes">
                    <label>Notes</label>
                    <input type="text" class="panel-input" v-model="mediationForm.notes" placeholder="Optional notes..." />
                  </div>
                  <div class="med-field med-submit">
                    <goa-button type="secondary" size="compact"
                                :disabled="!mediationForm.hearing_date"
                                @_click="scheduleMediationForAppeal">
                      Schedule Mediation
                    </goa-button>
                  </div>
                </div>
              </div>

              <!-- Existing Mediations -->
              <div v-if="mediations.length === 0" class="empty-state-inline">No mediations scheduled.</div>
              <div v-else class="mediation-list">
                <div v-for="med in mediations" :key="med.id" class="mediation-card">
                  <div class="mediation-card-header">
                    <span class="mediation-date-label">{{ formatDate(med.hearing_date) }}</span>
                    <span v-if="med.hearing_time" class="mediation-time">{{ med.hearing_time?.substring(0, 5) }}</span>
                    <span v-if="med.outcome" class="outcome-badge" :class="'outcome-' + med.outcome.toLowerCase()">{{ med.outcome }}</span>
                  </div>
                  <div class="mediation-card-body">
                    <span v-if="med.location">{{ med.location }}</span>
                    <span v-if="med.is_public === false" class="private-badge">Private</span>
                    <span v-if="med.notes" class="mediation-notes">{{ med.notes }}</span>
                  </div>
                  <div v-if="!med.outcome" class="mediation-card-actions">
                    <label class="outcome-label">Record Outcome:</label>
                    <goa-button type="tertiary" size="compact" @_click="recordMediationOutcome(med.id, 'Resolved')">Resolved</goa-button>
                    <goa-button type="tertiary" size="compact" @_click="recordMediationOutcome(med.id, 'Unresolved')">Unresolved</goa-button>
                    <goa-button type="tertiary" size="compact" @_click="recordMediationOutcome(med.id, 'Adjourned')">Adjourned</goa-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Hearings Section -->
            <div class="mediation-section">
              <h3>Hearings</h3>

              <!-- Schedule Hearing Form -->
              <div class="schedule-mediation-form">
                <div class="mediation-form-grid">
                  <div class="med-field">
                    <label>Date <span class="required">*</span></label>
                    <input type="date" class="panel-input" v-model="hearingForm.hearing_date" />
                  </div>
                  <div class="med-field">
                    <label>Time</label>
                    <input type="time" class="panel-input" v-model="hearingForm.hearing_time" />
                  </div>
                  <div class="med-field">
                    <label>Location</label>
                    <input type="text" class="panel-input" v-model="hearingForm.location" placeholder="e.g. MSAT Hearing Room" />
                  </div>
                  <div class="med-field">
                    <label>Public</label>
                    <select class="inline-select" v-model="hearingForm.is_public">
                      <option :value="true">Yes</option>
                      <option :value="false">No</option>
                    </select>
                  </div>
                  <div class="med-field med-notes">
                    <label>Notes</label>
                    <input type="text" class="panel-input" v-model="hearingForm.notes" placeholder="Optional notes..." />
                  </div>
                  <div class="med-field med-submit">
                    <goa-button type="secondary" size="compact"
                                :disabled="!hearingForm.hearing_date"
                                @_click="scheduleHearingForAppeal">
                      Schedule Hearing
                    </goa-button>
                  </div>
                </div>
              </div>

              <!-- Existing Hearings -->
              <div v-if="oralHearings.length === 0" class="empty-state-inline">No hearings scheduled.</div>
              <div v-else class="mediation-list">
                <div v-for="hr in oralHearings" :key="hr.id" class="mediation-card">
                  <div class="mediation-card-header">
                    <span class="mediation-date-label">{{ formatDate(hr.hearing_date) }}</span>
                    <span v-if="hr.hearing_time" class="mediation-time">{{ hr.hearing_time?.substring(0, 5) }}</span>
                    <span class="hearing-type-badge">Oral Hearing</span>
                    <span v-if="hr.outcome" class="outcome-badge" :class="'outcome-' + hr.outcome.toLowerCase()">{{ hr.outcome }}</span>
                  </div>
                  <div class="mediation-card-body">
                    <span v-if="hr.location">{{ hr.location }}</span>
                    <span v-if="hr.is_public === false" class="private-badge">Private</span>
                    <span v-if="hr.notes" class="mediation-notes">{{ hr.notes }}</span>
                  </div>
                  <div v-if="!hr.outcome" class="mediation-card-actions">
                    <label class="outcome-label">Record Outcome:</label>
                    <goa-button type="tertiary" size="compact" @_click="recordHearingOutcome(hr.id, 'Completed')">Completed</goa-button>
                    <goa-button type="tertiary" size="compact" @_click="recordHearingOutcome(hr.id, 'Adjourned')">Adjourned</goa-button>
                    <goa-button type="tertiary" size="compact" @_click="recordHearingOutcome(hr.id, 'Cancelled')">Cancelled</goa-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Orders / Decisions Section -->
            <div class="mediation-section">
              <h3>Orders / Decisions</h3>

              <!-- Record Order Form -->
              <div class="schedule-mediation-form">
                <div class="order-form-grid">
                  <div class="med-field">
                    <label>Issue Date <span class="required">*</span></label>
                    <input type="date" class="panel-input" v-model="orderForm.issue_date" />
                  </div>
                  <div class="med-field">
                    <label>Hearing Date</label>
                    <input type="date" class="panel-input" v-model="orderForm.hearing_date" />
                  </div>
                  <div class="med-field">
                    <label>Keyword</label>
                    <input type="text" class="panel-input" v-model="orderForm.keyword" placeholder="e.g. Land allocation dispute" />
                  </div>
                  <div class="med-field">
                    <label>Public</label>
                    <select class="inline-select" v-model="orderForm.is_public">
                      <option :value="true">Yes</option>
                      <option :value="false">No</option>
                    </select>
                  </div>
                  <div class="med-field">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="orderForm.app_for_leave" /> App for Leave
                    </label>
                  </div>
                  <div class="med-field">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="orderForm.leave_granted" /> Leave Granted
                    </label>
                  </div>
                </div>
                <div class="order-subjects-row">
                  <label class="subject-group-label">Subject Classification:</label>
                  <label class="checkbox-label"><input type="checkbox" v-model="orderForm.subjects.land" /> Land</label>
                  <label class="checkbox-label"><input type="checkbox" v-model="orderForm.subjects.membership" /> Membership</label>
                  <label class="checkbox-label"><input type="checkbox" v-model="orderForm.subjects.compensation" /> Compensation</label>
                  <label class="checkbox-label"><input type="checkbox" v-model="orderForm.subjects.descent_of_property" /> Descent of Property</label>
                  <label class="checkbox-label"><input type="checkbox" v-model="orderForm.subjects.pmt_cancellations" /> PMT Cancellations</label>
                  <label class="checkbox-label"><input type="checkbox" v-model="orderForm.subjects.trespass" /> Trespass</label>
                </div>
                <div class="order-submit-row">
                  <goa-button type="secondary" size="compact"
                              :disabled="!orderForm.issue_date"
                              @_click="recordOrderForAppeal">
                    Record Order
                  </goa-button>
                </div>
              </div>

              <!-- Existing Orders -->
              <div v-if="orders.length === 0" class="empty-state-inline">No orders recorded.</div>
              <div v-else class="mediation-list">
                <div v-for="ord in orders" :key="ord.id" class="mediation-card">
                  <div class="mediation-card-header">
                    <span class="order-number-badge">Order #{{ ord.order_number }}</span>
                    <span class="mediation-date-label">{{ formatDate(ord.issue_date) }}</span>
                    <span v-if="ord.is_public === false" class="private-badge">Private</span>
                    <span v-else class="public-badge">Public</span>
                  </div>
                  <div class="mediation-card-body">
                    <span v-if="ord.hearing_date">Hearing: {{ formatDate(ord.hearing_date) }}</span>
                    <span v-if="ord.keyword" class="mediation-notes">{{ ord.keyword }}</span>
                  </div>
                  <div class="order-card-meta">
                    <span v-if="ord.app_for_leave" class="order-flag-badge">App for Leave</span>
                    <span v-if="ord.leave_granted" class="order-flag-badge leave-granted">Leave Granted</span>
                    <span v-for="subj in getOrderSubjects(ord)" :key="subj" class="subject-badge">{{ subj }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Parties Tab -->
          <div v-if="activeTab === 'parties'" class="tab-panel">
            <!-- Add Party Form -->
            <div class="add-party-form">
              <h3>Add Party</h3>

              <!-- Party Source Toggle -->
              <div class="party-source-toggle">
                <button :class="['source-btn', partySource === 'client' ? 'source-active' : '']" @click="partySource = 'client'">Client</button>
                <button :class="['source-btn', partySource === 'organization' ? 'source-active' : '']" @click="partySource = 'organization'">Organization</button>
              </div>

              <!-- Client Search -->
              <div v-if="partySource === 'client'" class="add-party-row">
                <div class="search-container">
                  <label>Search Client</label>
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Search by name or member ID..."
                    v-model="clientSearchQuery"
                    @input="onClientSearch"
                    @focus="showSearchResults = true"
                    @blur="hideSearchResults"
                  />
                  <div v-if="showSearchResults && (searchResults.length > 0 || searchLoading || (clientSearchQuery.length >= 2 && !searchLoading))" class="search-results">
                    <div v-if="searchLoading" class="search-item search-loading">Searching...</div>
                    <div v-else-if="searchResults.length === 0 && clientSearchQuery.length >= 2" class="search-item search-empty">No clients found</div>
                    <div v-for="c in searchResults" :key="c.id"
                         class="search-item"
                         :class="{ selected: selectedClient?.id === c.id }"
                         @mousedown.prevent="selectClient(c)">
                      <span class="search-name">{{ c.first_name }} {{ c.last_name }}</span>
                      <span class="search-meta">{{ [c.member_id, c.settlement || c.city].filter(Boolean).join(' · ') }}</span>
                    </div>
                  </div>
                  <div v-if="selectedClient" class="selected-client">
                    {{ selectedClient.first_name }} {{ selectedClient.last_name }}
                    <button class="clear-btn" @click="clearSelectedClient">&times;</button>
                  </div>
                  <div v-if="!selectedClient && !showInlineCreate" class="inline-create-link">
                    <a href="#" @click.prevent="showInlineCreate = true">Create New Client</a>
                  </div>
                </div>
                <div class="party-type-select">
                  <label>Party Type</label>
                  <select v-model="newPartyType" class="inline-select">
                    <option value="Applicant">Applicant</option>
                    <option value="Respondent">Respondent</option>
                    <option value="Intervenor">Intervenor</option>
                    <option value="Affected Party">Affected Party</option>
                  </select>
                </div>
                <div class="add-party-action">
                  <goa-button type="secondary" size="compact" :disabled="!selectedClient" @_click="addPartyToAppeal">
                    Add Party
                  </goa-button>
                </div>
              </div>

              <!-- Inline Client Creation -->
              <div v-if="partySource === 'client' && showInlineCreate" class="inline-create-form">
                <h4>Create New Client</h4>
                <div class="inline-create-grid">
                  <div class="ic-field">
                    <label>First Name <span class="required">*</span></label>
                    <input type="text" class="panel-input" v-model="inlineClientForm.first_name" placeholder="First name" />
                  </div>
                  <div class="ic-field">
                    <label>Last Name <span class="required">*</span></label>
                    <input type="text" class="panel-input" v-model="inlineClientForm.last_name" placeholder="Last name" />
                  </div>
                  <div class="ic-field">
                    <label>Email</label>
                    <input type="email" class="panel-input" v-model="inlineClientForm.email" placeholder="email@example.com" />
                  </div>
                  <div class="ic-field">
                    <label>Phone (Cell)</label>
                    <input type="text" class="panel-input" v-model="inlineClientForm.phone_cell" placeholder="Phone" />
                  </div>
                  <div class="ic-field">
                    <label>Settlement</label>
                    <select class="panel-input" v-model="inlineClientForm.settlement">
                      <option value="">— Select —</option>
                      <option value="Buffalo Lake">Buffalo Lake</option>
                      <option value="East Prairie">East Prairie</option>
                      <option value="Elizabeth">Elizabeth</option>
                      <option value="Fishing Lake">Fishing Lake</option>
                      <option value="Gift Lake">Gift Lake</option>
                      <option value="Kikino">Kikino</option>
                      <option value="Paddle Prairie">Paddle Prairie</option>
                      <option value="Peavine">Peavine</option>
                    </select>
                  </div>
                </div>
                <div class="inline-create-actions">
                  <goa-button type="secondary" size="compact"
                              :disabled="!inlineClientForm.first_name?.trim() || !inlineClientForm.last_name?.trim()"
                              @_click="createInlineClient">
                    Create & Select
                  </goa-button>
                  <goa-button type="tertiary" size="compact" @_click="showInlineCreate = false">Cancel</goa-button>
                </div>
              </div>

              <!-- Organization Search -->
              <div v-if="partySource === 'organization'" class="add-party-row">
                <div class="search-container">
                  <label>Search Organization</label>
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Search by organization name..."
                    v-model="orgSearchQuery"
                    @input="onOrgSearch"
                    @focus="showOrgSearchResults = true"
                    @blur="hideOrgSearchResults"
                  />
                  <div v-if="showOrgSearchResults && (orgSearchResults.length > 0 || orgSearchLoading || (orgSearchQuery.length >= 2 && !orgSearchLoading))" class="search-results">
                    <div v-if="orgSearchLoading" class="search-item search-loading">Searching...</div>
                    <div v-else-if="orgSearchResults.length === 0 && orgSearchQuery.length >= 2" class="search-item search-empty">No organizations found</div>
                    <div v-for="o in orgSearchResults" :key="o.id"
                         class="search-item"
                         :class="{ selected: selectedOrg?.id === o.id }"
                         @mousedown.prevent="selectOrg(o)">
                      <span class="search-name">{{ o.name }}</span>
                      <span class="search-meta">{{ o.city || '' }}</span>
                    </div>
                  </div>
                  <div v-if="selectedOrg" class="selected-client selected-org">
                    {{ selectedOrg.name }}
                    <button class="clear-btn" @click="clearSelectedOrg">&times;</button>
                  </div>
                </div>
                <div class="party-type-select">
                  <label>Party Type</label>
                  <select v-model="newPartyType" class="inline-select">
                    <option value="Applicant">Applicant</option>
                    <option value="Respondent">Respondent</option>
                    <option value="Intervenor">Intervenor</option>
                    <option value="Affected Party">Affected Party</option>
                  </select>
                </div>
                <div class="add-party-action">
                  <goa-button type="secondary" size="compact" :disabled="!selectedOrg" @_click="addOrgPartyToAppeal">
                    Add Party
                  </goa-button>
                </div>
              </div>
            </div>

            <div v-if="parties.length === 0" class="empty-state">No parties linked to this appeal.</div>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Address</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="party in parties" :key="party.id">
                  <td>
                    <span class="party-badge" :class="'party-' + (party.party_type || '').toLowerCase().replace(/\s+/g, '-')">
                      {{ party.party_type }}
                    </span>
                  </td>
                  <td>
                    <span v-if="party.first_name">{{ party.first_name }} {{ party.last_name }}</span>
                    <span v-else-if="party.org_name" class="org-party-name">{{ party.org_name }}</span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <div v-if="party.client_email">{{ party.client_email }}</div>
                    <div v-if="party.phone_cell">{{ party.phone_cell }}</div>
                    <span v-if="!party.client_email && !party.phone_cell" class="muted">—</span>
                  </td>
                  <td>
                    <span v-if="party.address_1">{{ party.address_1 }}<template v-if="party.city">, {{ party.city }}</template><template v-if="party.province"> {{ party.province }}</template><template v-if="party.postal_code"> {{ party.postal_code }}</template></span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <goa-button type="tertiary" size="compact" @_click="removePartyFromAppeal(party.id, party.first_name || party.org_name)">
                      Remove
                    </goa-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Timeline Tab -->
          <div v-if="activeTab === 'timeline'" class="tab-panel">
            <div v-if="timelineEvents.length === 0" class="empty-state">No timeline events recorded.</div>
            <div v-else class="timeline">
              <div v-for="event in timelineEvents" :key="event.id" class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-action">{{ formatAction(event.action || event.type) }}</span>
                    <span class="timeline-date">{{ formatDateTime(event.created_at || event.date) }}</span>
                  </div>
                  <div v-if="event.performed_by" class="timeline-meta">by {{ event.performed_by }}</div>
                  <div v-if="event.details" class="timeline-details">{{ formatDetails(event.details) }}</div>
                  <div v-if="event.location" class="timeline-details">Location: {{ event.location }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel Tab -->
          <div v-if="activeTab === 'panel'" class="tab-panel">
            <!-- Assign Panel Form -->
            <div class="assign-panel-form">
              <h3>Assign Panel</h3>
              <div class="panel-form-grid">
                <div class="panel-field">
                  <label>Panel Chair <span class="required">*</span></label>
                  <input type="text" class="panel-input" v-model="panelForm.panel_chair"
                         list="board-member-list" placeholder="Type or select name..." />
                </div>
                <div class="panel-field">
                  <label>Panel Member 2 <span class="required">*</span></label>
                  <input type="text" class="panel-input" v-model="panelForm.panel_member_2"
                         list="board-member-list" placeholder="Type or select name..." />
                </div>
                <div class="panel-field">
                  <label>Panel Member 3</label>
                  <input type="text" class="panel-input" v-model="panelForm.panel_member_3"
                         list="board-member-list" placeholder="Optional" />
                </div>
                <div class="panel-field">
                  <label>Mediator</label>
                  <input type="text" class="panel-input" v-model="panelForm.mediator"
                         list="board-member-list" placeholder="Optional" />
                </div>
                <div class="panel-field">
                  <label>Date Assigned</label>
                  <input type="date" class="panel-input" v-model="panelForm.date_assigned" />
                </div>
                <div class="panel-field panel-submit">
                  <goa-button type="secondary" size="compact"
                              :disabled="!panelForm.panel_chair || !panelForm.panel_member_2"
                              @_click="assignPanelToAppeal">
                    Save Panel
                  </goa-button>
                </div>
              </div>
              <datalist id="board-member-list">
                <option v-for="name in boardMemberSuggestions" :key="name" :value="name" />
              </datalist>
            </div>

            <div v-if="panel.length === 0" class="empty-state">No panel compositions assigned yet.</div>
            <div v-else>
              <div v-for="pc in panel" :key="pc.id" class="panel-card">
                <div class="panel-header">
                  <span class="info-label">Panel Assigned</span>
                  <span v-if="pc.date_assigned">{{ formatDate(pc.date_assigned) }}</span>
                  <span v-else class="muted">Date not recorded</span>
                </div>
                <div class="panel-members">
                  <div class="panel-member">
                    <span class="member-role">Chair</span>
                    <span class="member-name">{{ pc.panel_chair || '—' }}</span>
                  </div>
                  <div class="panel-member">
                    <span class="member-role">Member</span>
                    <span class="member-name">{{ pc.panel_member_2 || '—' }}</span>
                  </div>
                  <div v-if="pc.panel_member_3" class="panel-member">
                    <span class="member-role">Member</span>
                    <span class="member-name">{{ pc.panel_member_3 }}</span>
                  </div>
                  <div v-if="pc.mediator" class="panel-member">
                    <span class="member-role">Mediator</span>
                    <span class="member-name">{{ pc.mediator }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Documents Tab -->
          <div v-if="activeTab === 'documents'" class="tab-panel">
            <!-- Upload Form Toggle -->
            <div class="doc-actions-bar">
              <goa-button type="primary" size="compact" @_click="showUploadForm = !showUploadForm">
                {{ showUploadForm ? 'Cancel' : 'Upload Document' }}
              </goa-button>
            </div>

            <!-- Upload Form -->
            <div v-if="showUploadForm" class="doc-upload-form">
              <h3>Upload Document</h3>
              <div class="doc-upload-grid">
                <div class="doc-field doc-file-field">
                  <label>File <span class="required">*</span></label>
                  <div class="file-input-wrapper">
                    <input type="file" ref="fileInput" @change="onFileSelected"
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" />
                  </div>
                  <div v-if="selectedFile" class="selected-file-info">
                    {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
                  </div>
                </div>
                <div class="doc-field">
                  <label>Category</label>
                  <select class="search-input" v-model="uploadCategory">
                    <option value="">— Select —</option>
                    <option v-for="cat in docCategories" :key="cat" :value="cat">{{ cat }}</option>
                  </select>
                </div>
                <div class="doc-field">
                  <label>Description</label>
                  <input type="text" class="search-input" v-model="uploadDescription" placeholder="Brief description..." />
                </div>
              </div>
              <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
                <div class="upload-progress-bar" :style="{ width: uploadProgress + '%' }"></div>
                <span>{{ uploadProgress }}%</span>
              </div>
              <div class="doc-upload-actions">
                <goa-button type="primary" size="compact" :disabled="!selectedFile || uploading" @_click="uploadDoc">
                  {{ uploading ? 'Uploading...' : 'Upload' }}
                </goa-button>
                <goa-button type="tertiary" size="compact" @_click="cancelUpload">Cancel</goa-button>
              </div>
            </div>

            <!-- Upload Feedback -->
            <div v-if="docFeedback" :class="['doc-feedback', docFeedbackError ? 'doc-feedback-error' : 'doc-feedback-success']">
              {{ docFeedback }}
            </div>

            <!-- Documents Table -->
            <div v-if="documents.length === 0 && !showUploadForm" class="empty-state">No documents uploaded.</div>
            <table v-if="documents.length > 0" class="data-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="doc in documents" :key="doc.id">
                  <td class="doc-name">{{ doc.original_name || doc.file_name }}</td>
                  <td><span class="doc-type-badge">{{ (doc.file_type || '').toUpperCase() }}</span></td>
                  <td>{{ doc.category || '—' }}</td>
                  <td>{{ doc.file_size ? formatFileSize(doc.file_size) : '—' }}</td>
                  <td>{{ formatDate(doc.created_at) }}</td>
                  <td class="doc-actions-cell">
                    <button class="doc-action-btn doc-download-btn" title="Download" @click="downloadDoc(doc)">&#8681;</button>
                    <button class="doc-action-btn doc-delete-btn" title="Delete" @click="confirmDeleteDoc(doc)">&#10005;</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Delete Confirmation -->
            <div v-if="docToDelete" class="doc-confirm-overlay" @click.self="docToDelete = null">
              <div class="doc-confirm-dialog">
                <p>Delete document <strong>"{{ docToDelete.original_name || docToDelete.file_name }}"</strong>?</p>
                <p class="doc-confirm-warning">This action cannot be undone.</p>
                <div class="doc-confirm-actions">
                  <goa-button type="primary" size="compact" @_click="deleteDoc">Delete</goa-button>
                  <goa-button type="tertiary" size="compact" @_click="docToDelete = null">Cancel</goa-button>
                </div>
              </div>
            </div>

            <!-- Hearing Packages Section -->
            <div class="hp-section">
              <div class="hp-section-header">
                <h3>Hearing Packages</h3>
                <goa-button v-if="documents.length > 0" type="secondary" size="compact"
                            @_click="showCompileForm = !showCompileForm">
                  {{ showCompileForm ? 'Cancel' : 'Compile Package' }}
                </goa-button>
              </div>

              <!-- Compile Hearing Package Form -->
              <div v-if="showCompileForm" class="hp-compile-form">
                <div class="hp-form-field">
                  <label>Package Name</label>
                  <input type="text" class="search-input" v-model="compilePkgName"
                         :placeholder="'Hearing Package — ' + new Date().toLocaleDateString('en-CA')" />
                </div>
                <div class="hp-doc-select">
                  <label>Select Documents <span class="required">*</span></label>
                  <div class="hp-doc-checkboxes">
                    <label v-for="doc in documents" :key="doc.id" class="hp-doc-check-item">
                      <input type="checkbox" :value="doc.id" v-model="selectedDocIds" />
                      <span class="hp-doc-check-name">{{ doc.original_name || doc.file_name }}</span>
                      <span class="hp-doc-check-meta">{{ (doc.file_type || '').toUpperCase() }} · {{ doc.category || 'No category' }}</span>
                    </label>
                  </div>
                  <div class="hp-select-actions">
                    <button class="hp-select-link" @click="selectedDocIds = documents.map(d => d.id)">Select All</button>
                    <button class="hp-select-link" @click="selectedDocIds = []">Clear</button>
                    <span class="hp-selected-count">{{ selectedDocIds.length }} of {{ documents.length }} selected</span>
                  </div>
                </div>
                <div class="hp-compile-actions">
                  <goa-button type="primary" size="compact"
                              :disabled="selectedDocIds.length === 0 || compilingPkg"
                              @_click="compileHearingPackage">
                    {{ compilingPkg ? 'Compiling...' : 'Compile' }}
                  </goa-button>
                </div>
              </div>

              <!-- Compiled Packages List -->
              <div v-if="hearingPackages.length === 0 && !showCompileForm" class="empty-state-inline">No hearing packages compiled.</div>
              <div v-if="hearingPackages.length > 0" class="hp-list">
                <div v-for="pkg in hearingPackages" :key="pkg.id" class="hp-card">
                  <div class="hp-card-header" @click="togglePkgExpand(pkg)">
                    <div class="hp-card-info">
                      <span class="hp-card-name">{{ pkg.name }}</span>
                      <span class="hp-card-meta">
                        {{ formatDate(pkg.compiled_date) }}
                        <template v-if="pkg.compiled_by_name"> · {{ pkg.compiled_by_name }}</template>
                      </span>
                    </div>
                    <div class="hp-card-right">
                      <span class="hp-status-badge">{{ pkg.status }}</span>
                      <span class="hp-doc-count">{{ pkg.document_count || '—' }} doc(s)</span>
                      <span class="hp-expand-icon" :class="{ 'hp-expanded': expandedPkg === pkg.id }">&#9660;</span>
                    </div>
                  </div>
                  <div v-if="expandedPkg === pkg.id" class="hp-card-body">
                    <div v-if="loadingPkgDocs" class="hp-loading">Loading documents...</div>
                    <table v-else-if="expandedPkgDocs.length > 0" class="hp-docs-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>File Name</th>
                          <th>Type</th>
                          <th>Category</th>
                          <th>Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="d in expandedPkgDocs" :key="d.id">
                          <td>{{ d.sort_order }}</td>
                          <td>{{ d.original_name || d.file_name }}</td>
                          <td><span class="doc-type-badge">{{ (d.file_type || '').toUpperCase() }}</span></td>
                          <td>{{ d.category || '—' }}</td>
                          <td>{{ d.file_size ? formatFileSize(d.file_size) : '—' }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="hp-loading">No documents in this package.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes Tab -->
          <div v-if="activeTab === 'notes'" class="tab-panel">
            <div v-if="!appeal.notes && correspondence.length === 0" class="empty-state">No notes or correspondence recorded.</div>

            <div v-if="appeal.notes" class="notes-section">
              <h3>Internal Notes</h3>
              <div class="notes-content">{{ appeal.notes }}</div>
            </div>

            <div v-if="correspondence.length > 0" class="notes-section">
              <h3>Correspondence</h3>
              <div v-for="c in correspondence" :key="c.id" class="correspondence-item">
                <div class="correspondence-header">
                  <span class="correspondence-subject">{{ c.subject || c.template_type || 'No subject' }}</span>
                  <span class="correspondence-date">{{ formatDateTime(c.sent_date || c.created_at) }}</span>
                </div>
                <div v-if="c.recipient" class="correspondence-meta">To: {{ c.recipient }}</div>
                <div v-if="c.sent_by" class="correspondence-meta">From: {{ c.sent_by }}</div>
                <div v-if="c.body" class="correspondence-body">{{ c.body }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api.js';

const route = useRoute();
const appeal = ref(null);
const parties = ref([]);
const panel = ref([]);
const documents = ref([]);
const timeline = ref([]);
const correspondence = ref([]);
const hearings = ref([]);
const orders = ref([]);
const loading = ref(true);
const error = ref('');
const activeTab = ref('overview');

// Edit mode state
const editingStatus = ref(false);
const editingStage = ref(false);
const statuses = ref([]);
const stages = ref([]);
const updateMessage = ref('');
const updateError = ref(false);

// Party management state
const partySource = ref('client');
const clientSearchQuery = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const showSearchResults = ref(false);
const selectedClient = ref(null);
const newPartyType = ref('Applicant');
let searchTimeout = null;

// Organization party state
const orgSearchQuery = ref('');
const orgSearchResults = ref([]);
const orgSearchLoading = ref(false);
const showOrgSearchResults = ref(false);
const selectedOrg = ref(null);
let orgSearchTimeout = null;

// Inline client creation state
const showInlineCreate = ref(false);
const inlineClientForm = ref({
  first_name: '', last_name: '', email: '', phone_cell: '', settlement: ''
});

// Document upload state
const showUploadForm = ref(false);
const selectedFile = ref(null);
const fileInput = ref(null);
const uploadCategory = ref('');
const uploadDescription = ref('');
const uploading = ref(false);
const uploadProgress = ref(0);
const docFeedback = ref('');
const docFeedbackError = ref(false);
const docToDelete = ref(null);
const docCategories = ['Filing', 'Submission', 'Evidence', 'Decision', 'Order', 'Correspondence', 'Hearing Package', 'Other'];

// Hearing package state
const hearingPackages = ref([]);
const showCompileForm = ref(false);
const selectedDocIds = ref([]);
const compilePkgName = ref('');
const compilingPkg = ref(false);
const expandedPkg = ref(null);
const expandedPkgDocs = ref([]);
const loadingPkgDocs = ref(false);

// Panel assignment state
const boardMembers = ref({ users: [], known_names: [] });
const panelForm = ref({
  panel_chair: '',
  panel_member_2: '',
  panel_member_3: '',
  mediator: '',
  date_assigned: new Date().toISOString().split('T')[0]
});

// Mediation state
const mediationForm = ref({
  hearing_date: '',
  hearing_time: '',
  location: '',
  notes: '',
  is_public: true
});

const mediations = computed(() => {
  return hearings.value.filter(h => h.hearing_type === 'Mediation').sort((a, b) => new Date(b.hearing_date) - new Date(a.hearing_date));
});

// Hearing state
const hearingForm = ref({
  hearing_date: '',
  hearing_time: '',
  location: '',
  notes: '',
  is_public: true
});

const oralHearings = computed(() => {
  return hearings.value.filter(h => h.hearing_type === 'Oral').sort((a, b) => new Date(b.hearing_date) - new Date(a.hearing_date));
});

// Order state
const orderForm = ref({
  issue_date: '',
  hearing_date: '',
  keyword: '',
  app_for_leave: false,
  leave_granted: false,
  is_public: true,
  subjects: { land: false, membership: false, compensation: false, descent_of_property: false, pmt_cancellations: false, trespass: false }
});

function getOrderSubjects(ord) {
  const subjects = [];
  if (ord.land) subjects.push('Land');
  if (ord.membership) subjects.push('Membership');
  if (ord.compensation) subjects.push('Compensation');
  if (ord.descent_of_property) subjects.push('Descent of Property');
  if (ord.pmt_cancellations) subjects.push('PMT Cancellations');
  if (ord.trespass) subjects.push('Trespass');
  return subjects;
}

const boardMemberSuggestions = computed(() => {
  const names = new Set();
  for (const u of boardMembers.value.users) {
    names.add(`${u.first_name} ${u.last_name}`);
  }
  for (const n of boardMembers.value.known_names) {
    names.add(n);
  }
  return [...names].sort();
});

// Build timeline from audit_log + hearings + key appeal dates
const timelineEvents = computed(() => {
  const events = [];

  // Add audit log entries
  for (const entry of timeline.value) {
    events.push({
      id: entry.id,
      action: entry.action,
      details: entry.details,
      performed_by: entry.performed_by,
      created_at: entry.created_at,
      type: 'audit'
    });
  }

  // Add hearing schedule entries
  for (const h of hearings.value) {
    events.push({
      id: 'hearing-' + h.id,
      action: `${h.hearing_type || 'Oral'} Hearing${h.is_public ? ' (Public)' : ''}`,
      date: h.hearing_date,
      created_at: h.hearing_date,
      location: h.location,
      type: 'hearing'
    });
  }

  // Sort by date descending
  events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return events;
});

const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'parties', label: 'Parties', count: parties.value.length },
  { key: 'timeline', label: 'Timeline', count: timelineEvents.value.length },
  { key: 'panel', label: 'Panel', count: panel.value.length },
  { key: 'documents', label: 'Documents', count: documents.value.length },
  { key: 'notes', label: 'Notes', count: (appeal.value?.notes ? 1 : 0) + correspondence.value.length }
]);

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString();
}

function formatDateTime(val) {
  if (!val) return '—';
  return new Date(val).toLocaleString();
}

function formatAction(action) {
  if (!action) return '—';
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDetails(details) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  // JSONB details — show key fields
  const parts = [];
  if (details.old_status && details.new_status) parts.push(`${details.old_status} → ${details.new_status}`);
  if (details.old_stage && details.new_stage) parts.push(`Stage ${details.old_stage} → ${details.new_stage}`);
  if (details.file_number) parts.push(`File: ${details.file_number}`);
  if (details.settlement) parts.push(`Settlement: ${details.settlement}`);
  if (details.issue_type) parts.push(`Issue: ${details.issue_type}`);
  if (details.appellant) parts.push(`Appellant: ${details.appellant}`);
  if (details.party_name) parts.push(`${details.party_name} (${details.party_type || ''})`);
  if (details.panel_chair) parts.push(`Chair: ${details.panel_chair}`);
  if (details.panel_member_2) parts.push(`Member: ${details.panel_member_2}`);
  if (details.panel_member_3) parts.push(`Member: ${details.panel_member_3}`);
  if (details.mediator) parts.push(`Mediator: ${details.mediator}`);
  if (details.hearing_date && !details.panel_chair) parts.push(`Date: ${new Date(details.hearing_date).toLocaleDateString()}`);
  if (details.location && !details.panel_chair) parts.push(`Location: ${details.location}`);
  if (details.stage_updated) parts.push(`Stage: ${details.stage_updated}`);
  if (details.outcome) parts.push(`Outcome: ${details.outcome}`);
  if (details.order_number) parts.push(`Order #${details.order_number}`);
  if (details.status_updated) parts.push(`Status: ${details.status_updated}`);
  if (details.name && details.document_count) parts.push(`${details.name} (${details.document_count} docs)`);
  if (details.file_name && !details.name) parts.push(`File: ${details.file_name}`);
  if (details.category && !details.file_number) parts.push(`Category: ${details.category}`);
  return parts.join(' | ');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Document management functions
function onFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
  }
}

function showDocFeedback(message, isError = false) {
  docFeedback.value = message;
  docFeedbackError.value = isError;
  setTimeout(() => { docFeedback.value = ''; }, 4000);
}

async function uploadDoc() {
  if (!selectedFile.value || uploading.value) return;

  const formData = new FormData();
  formData.append('file', selectedFile.value);
  if (uploadCategory.value) formData.append('category', uploadCategory.value);
  if (uploadDescription.value) formData.append('description', uploadDescription.value);

  uploading.value = true;
  uploadProgress.value = 0;

  try {
    const token = localStorage.getItem('msat_token');
    const baseURL = api.defaults.baseURL;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseURL}/appeals/${route.params.id}/documents`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      }
    });

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(data);
      };
      xhr.onerror = () => reject({ message: 'Upload failed' });
      xhr.send(formData);
    });

    showDocFeedback(result.message);
    cancelUpload();
    await loadAppeal();
  } catch (err) {
    showDocFeedback(err.message || 'Failed to upload document', true);
  } finally {
    uploading.value = false;
    uploadProgress.value = 0;
  }
}

function cancelUpload() {
  showUploadForm.value = false;
  selectedFile.value = null;
  uploadCategory.value = '';
  uploadDescription.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

async function downloadDoc(doc) {
  try {
    const token = localStorage.getItem('msat_token');
    const baseURL = api.defaults.baseURL;
    const response = await fetch(
      `${baseURL}/appeals/${route.params.id}/documents/${doc.id}/download`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.original_name || doc.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    showDocFeedback('Failed to download document', true);
  }
}

function confirmDeleteDoc(doc) {
  docToDelete.value = doc;
}

async function deleteDoc() {
  if (!docToDelete.value) return;
  const doc = docToDelete.value;
  try {
    const response = await api.delete(`/appeals/${route.params.id}/documents/${doc.id}`);
    if (response.success) {
      showDocFeedback(response.message);
      docToDelete.value = null;
      await loadAppeal();
    }
  } catch (err) {
    showDocFeedback(err.response?.data?.message || 'Failed to delete document', true);
  }
}

// Hearing package functions
async function compileHearingPackage() {
  if (selectedDocIds.value.length === 0 || compilingPkg.value) return;
  compilingPkg.value = true;
  try {
    const payload = { document_ids: selectedDocIds.value };
    if (compilePkgName.value.trim()) payload.name = compilePkgName.value.trim();
    const response = await api.post(`/appeals/${route.params.id}/hearing-packages`, payload);
    if (response.success) {
      showDocFeedback(response.message);
      showCompileForm.value = false;
      selectedDocIds.value = [];
      compilePkgName.value = '';
      await loadAppeal();
    }
  } catch (err) {
    showDocFeedback(err.response?.data?.message || 'Failed to compile hearing package', true);
  } finally {
    compilingPkg.value = false;
  }
}

async function togglePkgExpand(pkg) {
  if (expandedPkg.value === pkg.id) {
    expandedPkg.value = null;
    expandedPkgDocs.value = [];
    return;
  }
  expandedPkg.value = pkg.id;
  loadingPkgDocs.value = true;
  try {
    const response = await api.get(`/appeals/${route.params.id}/hearing-packages/${pkg.id}`);
    if (response.success) {
      expandedPkgDocs.value = response.documents || [];
    }
  } catch {
    expandedPkgDocs.value = [];
  } finally {
    loadingPkgDocs.value = false;
  }
}

async function loadAppeal() {
  loading.value = true;
  try {
    const response = await api.get(`/appeals/${route.params.id}`);
    if (response.success) {
      appeal.value = response.appeal;
      parties.value = response.parties || [];
      panel.value = response.panel || [];
      documents.value = response.documents || [];
      timeline.value = response.timeline || [];
      correspondence.value = response.correspondence || [];
      hearings.value = response.hearings || [];
      orders.value = response.orders || [];
      hearingPackages.value = response.hearing_packages || [];
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load appeal';
  } finally {
    loading.value = false;
  }
}

async function loadLookups() {
  try {
    const [statusesRes, stagesRes] = await Promise.all([
      api.get('/lookups/appeal-statuses'),
      api.get('/lookups/appeal-stages')
    ]);
    if (statusesRes.success) statuses.value = statusesRes.data;
    if (stagesRes.success) stages.value = stagesRes.data;
  } catch {
    // Lookups fail silently
  }
}

function startEditStatus() {
  editingStatus.value = true;
}

function startEditStage() {
  editingStage.value = true;
}

function showFeedback(message, isError = false) {
  updateMessage.value = message;
  updateError.value = isError;
  setTimeout(() => { updateMessage.value = ''; }, 3000);
}

async function onStatusChange(event) {
  const newStatus = event.target.value;
  editingStatus.value = false;
  if (newStatus === appeal.value.status) return;

  try {
    const response = await api.patch(`/appeals/${route.params.id}/status`, { status: newStatus });
    if (response.success) {
      showFeedback(`Status updated to "${newStatus}"`);
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to update status', true);
  }
}

async function onStageChange(event) {
  const newStage = event.target.value;
  editingStage.value = false;
  if (newStage === appeal.value.stage) return;

  try {
    const response = await api.patch(`/appeals/${route.params.id}/stage`, { stage: newStage });
    if (response.success) {
      showFeedback(`Stage updated to "${newStage}"`);
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to update stage', true);
  }
}

// Party management functions
function hideSearchResults() {
  setTimeout(() => { showSearchResults.value = false; }, 200);
}

function onClientSearch() {
  showSearchResults.value = true;
  selectedClient.value = null;
  clearTimeout(searchTimeout);
  if (clientSearchQuery.value.trim().length < 2) {
    searchResults.value = [];
    return;
  }
  searchLoading.value = true;
  searchTimeout = setTimeout(async () => {
    try {
      const response = await api.get(`/clients/search?q=${encodeURIComponent(clientSearchQuery.value.trim())}`);
      if (response.success) {
        searchResults.value = response.data;
      }
    } catch {
      searchResults.value = [];
    } finally {
      searchLoading.value = false;
    }
  }, 300);
}

function selectClient(client) {
  selectedClient.value = client;
  clientSearchQuery.value = '';
  searchResults.value = [];
  showSearchResults.value = false;
}

function clearSelectedClient() {
  selectedClient.value = null;
  clientSearchQuery.value = '';
}

async function addPartyToAppeal() {
  if (!selectedClient.value) return;
  try {
    const response = await api.post(`/appeals/${route.params.id}/parties`, {
      client_id: selectedClient.value.id,
      party_type: newPartyType.value
    });
    if (response.success) {
      showFeedback(response.message);
      clearSelectedClient();
      newPartyType.value = 'Applicant';
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to add party', true);
  }
}

async function removePartyFromAppeal(partyId, name) {
  if (!confirm(`Remove ${name || 'this party'} from the appeal?`)) return;
  try {
    const response = await api.delete(`/appeals/${route.params.id}/parties/${partyId}`);
    if (response.success) {
      showFeedback(response.message);
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to remove party', true);
  }
}

// Organization search functions
function hideOrgSearchResults() {
  setTimeout(() => { showOrgSearchResults.value = false; }, 200);
}

function onOrgSearch() {
  showOrgSearchResults.value = true;
  selectedOrg.value = null;
  clearTimeout(orgSearchTimeout);
  if (orgSearchQuery.value.trim().length < 2) {
    orgSearchResults.value = [];
    return;
  }
  orgSearchLoading.value = true;
  orgSearchTimeout = setTimeout(async () => {
    try {
      const response = await api.get(`/organizations/search?q=${encodeURIComponent(orgSearchQuery.value.trim())}`);
      if (response.success) {
        orgSearchResults.value = response.data;
      }
    } catch {
      orgSearchResults.value = [];
    } finally {
      orgSearchLoading.value = false;
    }
  }, 300);
}

function selectOrg(org) {
  selectedOrg.value = org;
  orgSearchQuery.value = '';
  orgSearchResults.value = [];
  showOrgSearchResults.value = false;
}

function clearSelectedOrg() {
  selectedOrg.value = null;
  orgSearchQuery.value = '';
}

async function addOrgPartyToAppeal() {
  if (!selectedOrg.value) return;
  try {
    const response = await api.post(`/appeals/${route.params.id}/parties`, {
      organization_id: selectedOrg.value.id,
      party_type: newPartyType.value
    });
    if (response.success) {
      showFeedback(response.message);
      clearSelectedOrg();
      newPartyType.value = 'Applicant';
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to add organization party', true);
  }
}

// Inline client creation
async function createInlineClient() {
  if (!inlineClientForm.value.first_name?.trim() || !inlineClientForm.value.last_name?.trim()) return;
  try {
    const payload = {};
    for (const [key, val] of Object.entries(inlineClientForm.value)) {
      if (val?.trim()) payload[key] = val.trim();
    }
    const response = await api.post('/clients', payload);
    if (response.success) {
      showFeedback(`Client ${response.client.first_name} ${response.client.last_name} created`);
      selectedClient.value = response.client;
      showInlineCreate.value = false;
      inlineClientForm.value = { first_name: '', last_name: '', email: '', phone_cell: '', settlement: '' };
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to create client', true);
  }
}

// Panel assignment functions
async function loadBoardMembers() {
  try {
    const response = await api.get('/lookups/board-members');
    if (response.success) {
      boardMembers.value = response.data;
    }
  } catch {
    // Board members fail silently
  }
}

async function assignPanelToAppeal() {
  if (!panelForm.value.panel_chair || !panelForm.value.panel_member_2) return;
  try {
    const payload = {
      panel_chair: panelForm.value.panel_chair.trim(),
      panel_member_2: panelForm.value.panel_member_2.trim()
    };
    if (panelForm.value.panel_member_3?.trim()) {
      payload.panel_member_3 = panelForm.value.panel_member_3.trim();
    }
    if (panelForm.value.mediator?.trim()) {
      payload.mediator = panelForm.value.mediator.trim();
    }
    if (panelForm.value.date_assigned) {
      payload.date_assigned = panelForm.value.date_assigned;
    }
    const response = await api.post(`/appeals/${route.params.id}/panel`, payload);
    if (response.success) {
      showFeedback(response.message);
      panelForm.value = {
        panel_chair: '',
        panel_member_2: '',
        panel_member_3: '',
        mediator: '',
        date_assigned: new Date().toISOString().split('T')[0]
      };
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to assign panel', true);
  }
}

// Mediation functions
async function scheduleMediationForAppeal() {
  if (!mediationForm.value.hearing_date) return;
  try {
    const payload = { hearing_date: mediationForm.value.hearing_date };
    if (mediationForm.value.hearing_time) payload.hearing_time = mediationForm.value.hearing_time;
    if (mediationForm.value.location?.trim()) payload.location = mediationForm.value.location.trim();
    if (mediationForm.value.notes?.trim()) payload.notes = mediationForm.value.notes.trim();
    payload.is_public = mediationForm.value.is_public;

    const response = await api.post(`/appeals/${route.params.id}/mediation`, payload);
    if (response.success) {
      showFeedback(response.message);
      mediationForm.value = { hearing_date: '', hearing_time: '', location: '', notes: '', is_public: true };
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to schedule mediation', true);
  }
}

async function recordMediationOutcome(mediationId, outcome) {
  try {
    const response = await api.patch(`/appeals/${route.params.id}/mediation/${mediationId}`, { outcome });
    if (response.success) {
      showFeedback(response.message);
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to record outcome', true);
  }
}

// Hearing functions
async function scheduleHearingForAppeal() {
  if (!hearingForm.value.hearing_date) return;
  try {
    const payload = { hearing_date: hearingForm.value.hearing_date };
    if (hearingForm.value.hearing_time) payload.hearing_time = hearingForm.value.hearing_time;
    if (hearingForm.value.location?.trim()) payload.location = hearingForm.value.location.trim();
    if (hearingForm.value.notes?.trim()) payload.notes = hearingForm.value.notes.trim();
    payload.is_public = hearingForm.value.is_public;

    const response = await api.post(`/appeals/${route.params.id}/hearing`, payload);
    if (response.success) {
      showFeedback(response.message);
      hearingForm.value = { hearing_date: '', hearing_time: '', location: '', notes: '', is_public: true };
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to schedule hearing', true);
  }
}

async function recordHearingOutcome(hearingId, outcome) {
  try {
    const response = await api.patch(`/appeals/${route.params.id}/hearing/${hearingId}`, { outcome });
    if (response.success) {
      showFeedback(response.message);
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to record outcome', true);
  }
}

// Order functions
async function recordOrderForAppeal() {
  if (!orderForm.value.issue_date) return;
  try {
    const payload = { issue_date: orderForm.value.issue_date };
    if (orderForm.value.hearing_date) payload.hearing_date = orderForm.value.hearing_date;
    if (orderForm.value.keyword?.trim()) payload.keyword = orderForm.value.keyword.trim();
    payload.app_for_leave = orderForm.value.app_for_leave;
    payload.leave_granted = orderForm.value.leave_granted;
    payload.is_public = orderForm.value.is_public;
    payload.subjects = { ...orderForm.value.subjects };

    const response = await api.post(`/appeals/${route.params.id}/orders`, payload);
    if (response.success) {
      showFeedback(response.message);
      orderForm.value = {
        issue_date: '', hearing_date: '', keyword: '',
        app_for_leave: false, leave_granted: false, is_public: true,
        subjects: { land: false, membership: false, compensation: false, descent_of_property: false, pmt_cancellations: false, trespass: false }
      };
      await loadAppeal();
    }
  } catch (err) {
    showFeedback(err.response?.data?.message || 'Failed to record order', true);
  }
}

onMounted(() => {
  loadLookups();
  loadBoardMembers();
  loadAppeal();
});
</script>

<style scoped>
.appeal-detail {
  padding: var(--goa-space-m) 0;
}

.page-header {
  margin-bottom: var(--goa-space-l);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.page-header h1 {
  font-size: var(--goa-font-size-8, 1.75rem);
  margin-bottom: var(--goa-space-2xs);
}

.page-header p {
  color: var(--goa-color-text-secondary, #666);
}

.loading-state, .error-state {
  padding: var(--goa-space-xl);
  text-align: center;
}

/* Status Bar */
.status-bar {
  display: flex;
  gap: var(--goa-space-xl);
  flex-wrap: wrap;
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m) var(--goa-space-l);
  margin-bottom: var(--goa-space-l);
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-2xs);
}

.status-label {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  font-weight: var(--goa-font-weight-bold, 700);
  text-transform: uppercase;
}

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.status-active { background: #d1fae5; color: #065f46; }
.status-new { background: #dbeafe; color: #1d4ed8; }
.status-closed { background: #e5e7eb; color: #374151; }
.status-on-hold { background: #fef3c7; color: #b45309; }
.status-withdrawn { background: #fee2e2; color: #991b1b; }
.status-conciliation { background: #ede9fe; color: #6d28d9; }
.status-conciliated { background: #ede9fe; color: #6d28d9; }
.status-mediation { background: #fce7f3; color: #be185d; }
.status-mediated { background: #fce7f3; color: #be185d; }
.status-order-issued { background: #dbeafe; color: #1e40af; }
.status-decision-letter-issued { background: #dbeafe; color: #1e40af; }
.status-no-merit { background: #e5e7eb; color: #374151; }
.status-no-jurisdiction { background: #e5e7eb; color: #374151; }

.stage-value {
  font-weight: var(--goa-font-weight-bold, 700);
}

/* Inline Edit Controls */
.editable-value {
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
  cursor: pointer;
}

.editable-value:hover .edit-icon {
  opacity: 1;
}

.edit-icon {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-interactive-default, #0070c4);
  opacity: 0.3;
  transition: opacity 0.15s;
}

.inline-edit {
  min-width: 140px;
}

.inline-select {
  padding: 4px 8px;
  border: 2px solid var(--goa-color-interactive-default, #0070c4);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
  background: white;
  outline: none;
  cursor: pointer;
}

/* Update Feedback */
.update-feedback {
  padding: var(--goa-space-xs) var(--goa-space-m);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
  margin-bottom: var(--goa-space-m);
  text-align: center;
}

.feedback-success {
  background: #d1fae5;
  color: #065f46;
}

.feedback-error {
  background: #fee2e2;
  color: #991b1b;
}

/* Tab Navigation */
.tabs-container {
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
}

.tab-nav {
  display: flex;
  border-bottom: 2px solid var(--goa-color-greyscale-200, #dcdcdc);
  overflow-x: auto;
}

.tab-button {
  padding: var(--goa-space-s) var(--goa-space-l);
  border: none;
  background: none;
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  cursor: pointer;
  position: relative;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
}

.tab-button:hover {
  color: var(--goa-color-interactive-default, #0070c4);
}

.tab-button.active {
  color: var(--goa-color-interactive-default, #0070c4);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--goa-color-interactive-default, #0070c4);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--goa-color-greyscale-200, #e5e7eb);
  font-size: var(--goa-font-size-2, 0.75rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.tab-button.active .tab-count {
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
}

.tab-content {
  padding: var(--goa-space-l);
}

.tab-panel {
  min-height: 200px;
}

/* Info Grid (Overview Tab) */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-2xs);
}

.info-label {
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #666);
  font-weight: var(--goa-font-weight-bold, 700);
}

.info-value {
  font-size: var(--goa-font-size-5, 1rem);
}

.file-number {
  font-family: monospace;
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-5, 1rem);
}

.text-block {
  margin-top: var(--goa-space-m);
  padding-top: var(--goa-space-m);
  border-top: 1px solid var(--goa-color-greyscale-200, #eee);
}

.text-block p {
  margin-top: var(--goa-space-2xs);
  white-space: pre-wrap;
}

/* Data Tables (Parties, Documents) */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: var(--goa-space-s) var(--goa-space-m);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.data-table th {
  background: var(--goa-color-greyscale-100, #f1f1f1);
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.party-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.party-applicant { background: #dbeafe; color: #1d4ed8; }
.party-respondent { background: #fef3c7; color: #b45309; }
.party-intervenor { background: #ede9fe; color: #6d28d9; }
.party-affected-party { background: #fce7f3; color: #be185d; }

/* Add Party Form */
.add-party-form {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.add-party-form h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.add-party-row {
  display: flex;
  gap: var(--goa-space-m);
  align-items: flex-end;
}

.search-container {
  flex: 1;
  position: relative;
}

.search-container label,
.party-type-select label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--goa-color-interactive-default, #0070c4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.2);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: 0 0 var(--goa-border-radius-m, 4px) var(--goa-border-radius-m, 4px);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.search-item {
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.search-item:hover, .search-item.selected {
  background: var(--goa-color-greyscale-100, #f1f1f1);
}

.search-item.search-loading,
.search-item.search-empty {
  color: var(--goa-color-text-secondary, #666);
  cursor: default;
  font-style: italic;
}

.search-name {
  font-weight: var(--goa-font-weight-bold, 700);
}

.search-meta {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.selected-client {
  margin-top: var(--goa-space-2xs);
  display: inline-flex;
  align-items: center;
  gap: var(--goa-space-xs);
  background: #dbeafe;
  color: #1d4ed8;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.clear-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: inherit;
  padding: 0;
  line-height: 1;
}

.party-type-select {
  min-width: 160px;
}

.add-party-action {
  padding-bottom: 2px;
}

/* Party Source Toggle */
.party-source-toggle {
  display: flex;
  gap: 0;
  margin-bottom: var(--goa-space-m);
}

.source-btn {
  padding: 6px 16px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  background: white;
  cursor: pointer;
  font-size: var(--goa-font-size-4, 0.875rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
}

.source-btn:first-child {
  border-radius: var(--goa-border-radius-m, 4px) 0 0 var(--goa-border-radius-m, 4px);
}

.source-btn:last-child {
  border-radius: 0 var(--goa-border-radius-m, 4px) var(--goa-border-radius-m, 4px) 0;
  border-left: none;
}

.source-active {
  background: var(--goa-color-interactive-default, #0070c4);
  color: white;
  border-color: var(--goa-color-interactive-default, #0070c4);
}

.selected-org {
  background: #fef3c7;
  color: #b45309;
}

.org-party-name {
  font-style: italic;
}

.inline-create-link {
  margin-top: var(--goa-space-2xs);
}

.inline-create-link a {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-interactive-default, #0070c4);
  text-decoration: none;
}

.inline-create-link a:hover {
  text-decoration: underline;
}

.inline-create-form {
  border: 1px dashed var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-top: var(--goa-space-s);
  background: white;
}

.inline-create-form h4 {
  font-size: var(--goa-font-size-4, 0.875rem);
  margin-bottom: var(--goa-space-s);
}

.inline-create-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  gap: var(--goa-space-s);
  align-items: end;
}

.ic-field label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.inline-create-actions {
  display: flex;
  gap: var(--goa-space-s);
  margin-top: var(--goa-space-s);
}

/* Document Upload */
.doc-actions-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--goa-space-m);
}

.doc-upload-form {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.doc-upload-form h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.doc-upload-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  gap: var(--goa-space-m);
  align-items: start;
}

.doc-field label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.doc-field .required {
  color: #b91c1c;
}

.file-input-wrapper input[type="file"] {
  width: 100%;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.selected-file-info {
  margin-top: var(--goa-space-2xs);
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.upload-progress {
  margin-top: var(--goa-space-s);
  background: var(--goa-color-greyscale-200, #e5e5e5);
  border-radius: 4px;
  height: 20px;
  position: relative;
  overflow: hidden;
}

.upload-progress-bar {
  height: 100%;
  background: var(--goa-color-interactive-default, #0070c4);
  border-radius: 4px;
  transition: width 0.2s ease;
}

.upload-progress span {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: white;
  line-height: 20px;
}

.doc-upload-actions {
  display: flex;
  gap: var(--goa-space-s);
  margin-top: var(--goa-space-m);
}

.doc-feedback {
  padding: var(--goa-space-s) var(--goa-space-m);
  border-radius: var(--goa-border-radius-m, 4px);
  margin-bottom: var(--goa-space-m);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.doc-feedback-success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.doc-feedback-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.doc-name {
  font-weight: var(--goa-font-weight-bold, 700);
  word-break: break-word;
}

.doc-type-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: var(--goa-font-size-3, 0.75rem);
  font-weight: var(--goa-font-weight-bold, 700);
  background: var(--goa-color-greyscale-100, #f1f1f1);
  color: var(--goa-color-text-secondary, #666);
  text-transform: uppercase;
}

.doc-actions-cell {
  display: flex;
  gap: var(--goa-space-xs);
  white-space: nowrap;
}

.doc-action-btn {
  background: none;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 1rem;
  line-height: 1;
}

.doc-download-btn {
  color: var(--goa-color-interactive-default, #0070c4);
}

.doc-download-btn:hover {
  background: #dbeafe;
  border-color: var(--goa-color-interactive-default, #0070c4);
}

.doc-delete-btn {
  color: #b91c1c;
}

.doc-delete-btn:hover {
  background: #fee2e2;
  border-color: #b91c1c;
}

.doc-confirm-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  justify-content: center;
  align-items: center;
}

.doc-confirm-dialog {
  background: white;
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-l);
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.doc-confirm-warning {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  margin-top: var(--goa-space-2xs);
}

.doc-confirm-actions {
  display: flex;
  gap: var(--goa-space-s);
  margin-top: var(--goa-space-m);
}

@media (max-width: 768px) {
  .doc-upload-grid {
    grid-template-columns: 1fr;
  }
}

/* Hearing Packages */
.hp-section {
  margin-top: var(--goa-space-xl);
  border-top: 2px solid var(--goa-color-greyscale-200, #dcdcdc);
  padding-top: var(--goa-space-l);
}

.hp-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-m);
}

.hp-section-header h3 {
  margin: 0;
  font-size: var(--goa-font-size-5, 1rem);
}

.hp-compile-form {
  background: var(--goa-color-greyscale-100, #f9f9f9);
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
}

.hp-form-field {
  margin-bottom: var(--goa-space-m);
}

.hp-form-field label {
  display: block;
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-3, 0.8rem);
  margin-bottom: var(--goa-space-2xs);
}

.hp-doc-select {
  margin-bottom: var(--goa-space-m);
}

.hp-doc-select > label {
  display: block;
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-3, 0.8rem);
  margin-bottom: var(--goa-space-xs);
}

.hp-doc-checkboxes {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  background: white;
}

.hp-doc-check-item {
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
  padding: var(--goa-space-xs) var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-100, #f5f5f5);
  cursor: pointer;
  font-size: var(--goa-font-size-4, 0.875rem);
}

.hp-doc-check-item:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.hp-doc-check-item:last-child {
  border-bottom: none;
}

.hp-doc-check-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hp-doc-check-meta {
  font-size: var(--goa-font-size-2, 0.75rem);
  color: var(--goa-color-text-secondary, #666);
  white-space: nowrap;
}

.hp-select-actions {
  display: flex;
  gap: var(--goa-space-m);
  align-items: center;
  margin-top: var(--goa-space-xs);
}

.hp-select-link {
  background: none;
  border: none;
  color: var(--goa-color-interactive-default, #0070c4);
  font-size: var(--goa-font-size-3, 0.8rem);
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.hp-select-link:hover {
  color: var(--goa-color-interactive-hover, #004f8a);
}

.hp-selected-count {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  margin-left: auto;
}

.hp-compile-actions {
  display: flex;
  gap: var(--goa-space-s);
}

.hp-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
}

.hp-card {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  overflow: hidden;
}

.hp-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--goa-space-s) var(--goa-space-m);
  cursor: pointer;
  background: white;
  transition: background 0.15s;
}

.hp-card-header:hover {
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.hp-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hp-card-name {
  font-weight: var(--goa-font-weight-bold, 700);
  font-size: var(--goa-font-size-4, 0.875rem);
}

.hp-card-meta {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.hp-card-right {
  display: flex;
  align-items: center;
  gap: var(--goa-space-s);
}

.hp-status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--goa-font-size-2, 0.75rem);
  font-weight: var(--goa-font-weight-bold, 700);
  background: #dbeafe;
  color: #1d4ed8;
}

.hp-doc-count {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.hp-expand-icon {
  font-size: var(--goa-font-size-2, 0.75rem);
  color: var(--goa-color-text-secondary, #666);
  transition: transform 0.2s;
}

.hp-expanded {
  transform: rotate(180deg);
}

.hp-card-body {
  border-top: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  padding: var(--goa-space-s) var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.hp-loading {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  padding: var(--goa-space-xs) 0;
}

.hp-docs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--goa-font-size-3, 0.8rem);
}

.hp-docs-table th,
.hp-docs-table td {
  padding: var(--goa-space-2xs) var(--goa-space-xs);
  text-align: left;
  border-bottom: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
}

.hp-docs-table th {
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  font-size: var(--goa-font-size-2, 0.75rem);
  text-transform: uppercase;
}

.hp-docs-table tr:last-child td {
  border-bottom: none;
}

/* Timeline Tab */
.timeline {
  position: relative;
  padding-left: var(--goa-space-l);
}

.timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--goa-color-greyscale-200, #dcdcdc);
}

.timeline-item {
  position: relative;
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-m);
}

.timeline-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: calc(-1 * var(--goa-space-l) + 3px);
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--goa-color-interactive-default, #0070c4);
  border: 2px solid white;
}

.timeline-content {
  background: var(--goa-color-greyscale-100, #f9f9f9);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-s) var(--goa-space-m);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--goa-space-m);
}

.timeline-action {
  font-weight: var(--goa-font-weight-bold, 700);
}

.timeline-date {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  white-space: nowrap;
}

.timeline-meta {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  margin-top: var(--goa-space-2xs);
}

.timeline-details {
  font-size: var(--goa-font-size-4, 0.875rem);
  margin-top: var(--goa-space-2xs);
  color: var(--goa-color-text-secondary, #444);
}

/* Panel Tab */
.panel-card {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
}

.panel-card:last-child {
  margin-bottom: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-m);
  padding-bottom: var(--goa-space-s);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #eee);
}

.panel-members {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--goa-space-m);
}

.panel-member {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-2xs);
}

.member-role {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  font-weight: var(--goa-font-weight-bold, 700);
  text-transform: uppercase;
}

.member-name {
  font-size: var(--goa-font-size-5, 1rem);
}

/* Assign Panel Form */
.assign-panel-form {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.assign-panel-form h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.panel-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--goa-space-m);
  align-items: end;
}

.panel-field label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.panel-field .required {
  color: #b91c1c;
}

.panel-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--goa-color-greyscale-200, #ccc);
  border-radius: var(--goa-border-radius-m, 4px);
  font-size: var(--goa-font-size-4, 0.875rem);
  box-sizing: border-box;
}

.panel-input:focus {
  border-color: var(--goa-color-interactive-default, #0070c4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 112, 196, 0.2);
}

.panel-submit {
  display: flex;
  align-items: flex-end;
}

/* Mediation Section */
.mediation-section {
  margin-top: var(--goa-space-l);
  padding-top: var(--goa-space-m);
  border-top: 1px solid var(--goa-color-greyscale-200, #eee);
}

.mediation-section h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
}

.schedule-mediation-form {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-m);
  background: var(--goa-color-greyscale-100, #f9f9f9);
}

.mediation-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: var(--goa-space-m);
  align-items: end;
}

.med-field label {
  display: block;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  margin-bottom: var(--goa-space-2xs);
  text-transform: uppercase;
}

.med-notes {
  grid-column: span 2;
}

.med-submit {
  display: flex;
  align-items: flex-end;
}

.empty-state-inline {
  padding: var(--goa-space-m);
  text-align: center;
  color: var(--goa-color-text-secondary, #666);
  font-style: italic;
}

.mediation-list {
  display: flex;
  flex-direction: column;
  gap: var(--goa-space-s);
}

.mediation-card {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-s) var(--goa-space-m);
}

.mediation-card-header {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  margin-bottom: var(--goa-space-2xs);
}

.mediation-date-label {
  font-weight: var(--goa-font-weight-bold, 700);
}

.mediation-time {
  color: var(--goa-color-text-secondary, #666);
}

.outcome-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
}

.outcome-resolved { background: #d1fae5; color: #065f46; }
.outcome-unresolved { background: #fee2e2; color: #991b1b; }
.outcome-adjourned { background: #fef3c7; color: #b45309; }
.outcome-completed { background: #d1fae5; color: #065f46; }
.outcome-cancelled { background: #fee2e2; color: #991b1b; }

.hearing-type-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.75rem);
  background: #dbeafe;
  color: #1e40af;
  font-weight: var(--goa-font-weight-bold, 700);
}

.mediation-card-body {
  display: flex;
  gap: var(--goa-space-m);
  align-items: center;
  font-size: var(--goa-font-size-4, 0.875rem);
  color: var(--goa-color-text-secondary, #444);
}

.private-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.75rem);
  background: #e5e7eb;
  color: #374151;
}

.mediation-notes {
  font-style: italic;
}

.mediation-card-actions {
  display: flex;
  align-items: center;
  gap: var(--goa-space-xs);
  margin-top: var(--goa-space-xs);
  padding-top: var(--goa-space-xs);
  border-top: 1px solid var(--goa-color-greyscale-200, #eee);
}

.outcome-label {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
  font-weight: var(--goa-font-weight-bold, 700);
}

/* Orders Section */
.order-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
  gap: var(--goa-space-m);
  align-items: end;
}

.order-subjects-row {
  display: flex;
  align-items: center;
  gap: var(--goa-space-m);
  margin-top: var(--goa-space-s);
  flex-wrap: wrap;
}

.subject-group-label {
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  color: var(--goa-color-text-secondary, #666);
  text-transform: uppercase;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--goa-font-size-4, 0.875rem);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.order-submit-row {
  margin-top: var(--goa-space-s);
  display: flex;
  justify-content: flex-start;
}

.order-number-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--goa-font-size-3, 0.8rem);
  font-weight: var(--goa-font-weight-bold, 700);
  background: #4338ca;
  color: #fff;
}

.public-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.75rem);
  background: #d1fae5;
  color: #065f46;
  font-weight: var(--goa-font-weight-bold, 700);
}

.order-card-meta {
  display: flex;
  gap: var(--goa-space-xs);
  margin-top: var(--goa-space-2xs);
  flex-wrap: wrap;
}

.order-flag-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.75rem);
  background: #fef3c7;
  color: #b45309;
  font-weight: var(--goa-font-weight-bold, 700);
}

.order-flag-badge.leave-granted {
  background: #d1fae5;
  color: #065f46;
}

.subject-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: var(--goa-font-size-2, 0.75rem);
  background: #e0e7ff;
  color: #3730a3;
  font-weight: var(--goa-font-weight-bold, 700);
}

/* Notes Tab */
.notes-section {
  margin-bottom: var(--goa-space-l);
}

.notes-section:last-child {
  margin-bottom: 0;
}

.notes-section h3 {
  font-size: var(--goa-font-size-5, 1rem);
  margin-bottom: var(--goa-space-s);
  padding-bottom: var(--goa-space-xs);
  border-bottom: 1px solid var(--goa-color-greyscale-200, #eee);
}

.notes-content {
  white-space: pre-wrap;
  background: var(--goa-color-greyscale-100, #f9f9f9);
  padding: var(--goa-space-m);
  border-radius: var(--goa-border-radius-m, 4px);
}

.correspondence-item {
  border: 1px solid var(--goa-color-greyscale-200, #dcdcdc);
  border-radius: var(--goa-border-radius-m, 4px);
  padding: var(--goa-space-m);
  margin-bottom: var(--goa-space-s);
}

.correspondence-item:last-child {
  margin-bottom: 0;
}

.correspondence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--goa-space-xs);
}

.correspondence-subject {
  font-weight: var(--goa-font-weight-bold, 700);
}

.correspondence-date {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.correspondence-meta {
  font-size: var(--goa-font-size-3, 0.8rem);
  color: var(--goa-color-text-secondary, #666);
}

.correspondence-body {
  margin-top: var(--goa-space-s);
  white-space: pre-wrap;
  font-size: var(--goa-font-size-4, 0.875rem);
}

/* Shared */
.empty-state {
  padding: var(--goa-space-xl);
  text-align: center;
  color: var(--goa-color-text-secondary, #666);
}

.muted {
  color: var(--goa-color-text-secondary, #666);
}

@media (max-width: 768px) {
  .tab-nav {
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }

  .tab-button {
    padding: var(--goa-space-s) var(--goa-space-m);
    font-size: var(--goa-font-size-3, 0.8rem);
  }

  .status-bar {
    gap: var(--goa-space-m);
  }

  .info-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

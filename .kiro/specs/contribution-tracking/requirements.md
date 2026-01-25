# Requirements Document

## Introduction

This document specifies the requirements for a contribution tracking system that transforms the existing `/통계` (statistics) command into a `/기여도` (contribution) command. The system will track and rank user contributions to inventory management and crafting activities based on a configurable point system.

## Glossary

- **Contribution_System**: The system that tracks, calculates, and displays user contributions
- **Item_Points**: User-configurable score values assigned to each item (default: 1)
- **Contribution_Score**: Calculated value representing a user's contribution ((Count × Quantity × Item Points) / 100, rounded to 2 decimal places)
- **History_Entry**: A record of a user action (add, update, craft) stored in the database
- **Ranking_Display**: Visual representation showing top contributors in each category
- **Points_Manager**: Interface for managing item point values

## Requirements

### Requirement 1: Contribution Score Calculation

**User Story:** As a guild administrator, I want contributions to be calculated using a configurable formula, so that I can fairly recognize user efforts based on item importance.

#### Acceptance Criteria

1. WHEN calculating a contribution score, THE Contribution_System SHALL multiply count by quantity by item points, then divide by 100
2. WHEN an item has no configured point value, THE Contribution_System SHALL use a default value of 1
3. WHEN a user performs multiple actions on the same item, THE Contribution_System SHALL sum all contribution scores for that item
4. WHEN calculating inventory contributions, THE Contribution_System SHALL count all quantity changes including additions, subtractions, and updates
5. WHEN calculating crafting contributions, THE Contribution_System SHALL count all crafting actions with their quantities
6. WHEN calculating quantity changes from updates, THE Contribution_System SHALL use the absolute difference to count both increases and decreases
7. WHEN displaying contribution scores, THE Contribution_System SHALL round the final score to 2 decimal places for readability

### Requirement 2: Item Points Management

**User Story:** As a guild administrator, I want to set custom point values for items, so that I can weight contributions based on item rarity or importance.

#### Acceptance Criteria

1. THE Points_Manager SHALL allow users to view all item point values for both inventory and crafting items
2. WHEN a user edits an item's point value, THE Points_Manager SHALL validate the input is a positive number
3. WHEN a user resets item points, THE Points_Manager SHALL set all point values back to the default of 1
4. THE Points_Manager SHALL store point values separately for inventory items and crafting items
5. WHEN displaying item points, THE Points_Manager SHALL show items grouped by category with pagination support for more than 25 items

### Requirement 3: Contribution Command Display

**User Story:** As a guild member, I want to see contribution rankings, so that I can understand who is contributing most to our shared goals.

#### Acceptance Criteria

1. WHEN a user executes `/기여도`, THE Ranking_Display SHALL show two separate ranking sections for inventory and crafting
2. WHEN displaying rankings, THE Ranking_Display SHALL show the top 3 users in each category
3. WHEN displaying a ranking entry, THE Ranking_Display SHALL include rank position, username, and total contribution score (divided by 100 and rounded to 2 decimal places)
4. WHEN displaying rankings, THE Ranking_Display SHALL use medal emojis (🥇🥈🥉) for the top 3 positions
5. WHEN no contribution data exists for a category, THE Ranking_Display SHALL show an appropriate message indicating no data
6. WHEN displaying contribution scores, THE Ranking_Display SHALL format numbers with appropriate decimal places (e.g., "1234.56" instead of "123456")

### Requirement 4: Data Persistence

**User Story:** As a system administrator, I want contribution data to be stored reliably, so that rankings remain accurate over time.

#### Acceptance Criteria

1. THE Contribution_System SHALL store item point values in the Setting collection in MongoDB
2. THE Contribution_System SHALL retrieve contribution data from existing History_Entry records
3. WHEN item points are updated, THE Contribution_System SHALL persist changes immediately to the database
4. THE Contribution_System SHALL maintain separate point configurations for inventory and crafting items
5. WHEN calculating contributions, THE Contribution_System SHALL use the current point values (not historical values)

### Requirement 5: User Interface Integration

**User Story:** As a user, I want the contribution system to follow existing UI patterns, so that it feels consistent with other bot commands.

#### Acceptance Criteria

1. THE Contribution_System SHALL use Discord embeds for displaying rankings
2. THE Points_Manager SHALL use button handlers, select menus, and modals following existing patterns
3. WHEN displaying temporary messages, THE Contribution_System SHALL apply the user-configured timeout settings
4. THE Points_Manager SHALL use optional chaining for all nested object access
5. WHEN errors occur, THE Contribution_System SHALL display user-friendly Korean error messages

### Requirement 6: History Data Integration

**User Story:** As a developer, I want to leverage existing history data, so that contributions are calculated from actual user actions without requiring new tracking.

#### Acceptance Criteria

1. WHEN calculating inventory contributions, THE Contribution_System SHALL parse quantity values from History_Entry details field
2. WHEN parsing "초기: N개" format, THE Contribution_System SHALL extract the initial quantity value
3. WHEN parsing "N -> M" format, THE Contribution_System SHALL calculate the absolute difference |M - N| and count both increases and decreases as contributions
4. WHEN parsing "N개 추가" format, THE Contribution_System SHALL extract the added quantity
5. WHEN parsing "N개 차감" format, THE Contribution_System SHALL extract the subtracted quantity and count it as a contribution
6. WHEN parsing "수정: N -> M" format from update actions, THE Contribution_System SHALL calculate the absolute difference |M - N| as contribution
7. WHEN an action is 'remove' or 'reset', THE Contribution_System SHALL assign zero contribution points
8. WHEN an action is 'update_required', THE Contribution_System SHALL parse the quantity change and count the absolute difference

### Requirement 7: Points Management Interface

**User Story:** As a guild administrator, I want an intuitive interface to manage item points, so that I can easily adjust contribution weights.

#### Acceptance Criteria

1. WHEN accessing points management, THE Points_Manager SHALL display a button to open the management interface
2. WHEN viewing item points, THE Points_Manager SHALL show items in a select menu with current point values in descriptions
3. WHEN a user selects an item to edit, THE Points_Manager SHALL display a modal with the current point value pre-filled
4. WHEN more than 25 items exist in a category, THE Points_Manager SHALL provide pagination buttons
5. WHEN a user submits a point value change, THE Points_Manager SHALL update the database and display a success message

### Requirement 8: Command Replacement

**User Story:** As a user, I want the new contribution command to replace the old statistics command, so that I have access to more meaningful metrics.

#### Acceptance Criteria

1. THE Contribution_System SHALL provide a `/기여도` command that replaces `/통계`
2. WHEN the command is executed, THE Contribution_System SHALL display contribution rankings instead of general statistics
3. THE Contribution_System SHALL maintain the existing message persistence behavior (no auto-delete)
4. THE Contribution_System SHALL use the same embed styling and color scheme as existing commands
5. THE Contribution_System SHALL include a timestamp in the embed footer

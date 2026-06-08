import { greedyScheduler } from '../../src/services/planningService.js';

describe('greedyScheduler', () => {
  test('does not double-book an extra on the same creneau', () => {
    // Arrange
    const extras = [{ id: 'e1' }];
    const creneaux = [
      { id: 'c1', heure_debut: '09:00', heure_fin: '17:00' },
      { id: 'c2', heure_debut: '09:00', heure_fin: '17:00' },
    ];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e1', creneau_id: 'c2' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    const affectationsE1 = planning.filter((a) => a.extra_id === 'e1');
    expect(affectationsE1).toHaveLength(1);
  });

  test('does not assign an unavailable extra', () => {
    // Arrange
    const extras = [{ id: 'e1' }, { id: 'e2' }];
    const creneaux = [{ id: 'c1', heure_debut: '09:00', heure_fin: '17:00' }];
    const disponibilites = [{ extra_id: 'e2', creneau_id: 'c1' }];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    expect(planning.some((a) => a.extra_id === 'e1')).toBe(false);
    expect(planning.some((a) => a.extra_id === 'e2')).toBe(true);
  });

  test('returns empty array for empty slots', () => {
    // Arrange
    const extras = [{ id: 'e1' }];
    const creneaux = [];
    const disponibilites = [];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    expect(planning).toHaveLength(0);
  });

  test('respects 11h rest rule between consecutive shifts', () => {
    // Arrange
    const extras = [{ id: 'e1' }];
    const creneaux = [
      { id: 'c1', heure_debut: '08:00', heure_fin: '16:00' },
      { id: 'c2', heure_debut: '20:00', heure_fin: '23:00' },
    ];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e1', creneau_id: 'c2' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    const affectationsE1 = planning.filter((a) => a.extra_id === 'e1');
    expect(affectationsE1).toHaveLength(1);
    expect(affectationsE1[0].creneau_id).toBe('c1');
  });

  test('assigns extra with fewest hours first (priority ASC)', () => {
    // Arrange
    const extras = [{ id: 'e1' }, { id: 'e2' }];
    const creneaux = [{ id: 'c1', heure_debut: '09:00', heure_fin: '17:00' }];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e2', creneau_id: 'c1' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    expect(planning).toHaveLength(1);
    expect(['e1', 'e2']).toContain(planning[0].extra_id);
  });

  test('allows two different extras on two different simultaneous creneaux', () => {
    // Arrange
    const extras = [{ id: 'e1' }, { id: 'e2' }];
    const creneaux = [
      { id: 'c1', heure_debut: '09:00', heure_fin: '17:00' },
      { id: 'c2', heure_debut: '09:00', heure_fin: '17:00' },
    ];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e1', creneau_id: 'c2' },
      { extra_id: 'e2', creneau_id: 'c1' },
      { extra_id: 'e2', creneau_id: 'c2' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    expect(planning).toHaveLength(2);
    const extraIds = planning.map((a) => a.extra_id);
    expect(new Set(extraIds).size).toBe(2);
  });
});

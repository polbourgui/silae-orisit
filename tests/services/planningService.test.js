import { greedyScheduler } from '../../src/services/planningService.js';

describe('greedyScheduler', () => {
  const creneauMatin = { id: 'c1', heure_debut: '09:00', heure_fin: '17:00', slot_label: 'lun-matin' };
  const creneauSoir  = { id: 'c2', heure_debut: '18:00', heure_fin: '23:00', slot_label: 'lun-soir' };
  const creneauNuit  = { id: 'c3', heure_debut: '00:00', heure_fin: '06:00', slot_label: 'lun-nuit' };

  test('ne double-booke pas un extra sur deux créneaux simultanés', () => {
    // Arrange
    const extras = [{ id: 'e1' }];
    const creneaux = [creneauMatin, { ...creneauMatin, id: 'c2b' }];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e1', creneau_id: 'c2b' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    const affectationsE1 = planning.filter((a) => a.extra_id === 'e1');
    expect(affectationsE1).toHaveLength(1);
  });

  test('n\'affecte pas un extra indisponible', () => {
    // Arrange
    const extras = [{ id: 'e1' }, { id: 'e2' }];
    const creneaux = [creneauMatin];
    const disponibilites = [{ extra_id: 'e2', creneau_id: 'c1' }];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    expect(planning.find((a) => a.extra_id === 'e1')).toBeUndefined();
    expect(planning.find((a) => a.extra_id === 'e2')).toBeDefined();
  });

  test('retourne un tableau vide si aucun créneau', () => {
    // Arrange
    const extras = [{ id: 'e1' }];
    const creneaux = [];
    const disponibilites = [];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert
    expect(planning).toHaveLength(0);
  });

  test('respecte la règle des 11h de repos entre créneaux', () => {
    // Arrange — matin se termine à 17h, nuit commence à 00h : gap = 7h < 11h
    const extras = [{ id: 'e1' }];
    const creneaux = [creneauMatin, creneauNuit];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e1', creneau_id: 'c3' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert — e1 ne peut pas être sur les deux
    expect(planning).toHaveLength(1);
  });

  test('priorise l\'extra avec le moins d\'heures affectées', () => {
    // Arrange
    const extras = [{ id: 'e1' }, { id: 'e2' }];
    const creneaux = [creneauMatin, creneauSoir];
    const disponibilites = [
      { extra_id: 'e1', creneau_id: 'c1' },
      { extra_id: 'e1', creneau_id: 'c2' },
      { extra_id: 'e2', creneau_id: 'c2' },
    ];

    // Act
    const planning = greedyScheduler(extras, creneaux, disponibilites);

    // Assert — e1 prend c1, e2 prend c2 (e2 a 0h vs e1 qui a 8h après c1)
    expect(planning.find((a) => a.creneau_id === 'c2')?.extra_id).toBe('e2');
  });
});

import { db } from 'db';
import { skill } from 'db/schema/linkedin/skills-schema';
import { inArray } from 'drizzle-orm';

export const findOrInsertSkills = async (skills: string[]): Promise<{ [name: string]: number }> => {
    // Step 1: Find existing skills
    const existingTechs = await db
        .select({
            id: skill.id,
            name: skill.name,
        })
        .from(skill)
        .where(inArray(skill.name, skills));

    // Step 2: Identify new skills
    const existingNames = existingTechs.map(tech => tech.name);
    const newTechNames = [...new Set(skills.filter(name => !existingNames.includes(name)))];

    // Step 3: Insert new skills if any
    let newTechs: { id: number; name: string }[] = [];
    if (newTechNames.length > 0) {
        newTechs = await db
            .insert(skill)
            .values(newTechNames.map(name => ({ name })))
            .returning({
                id: skill.id,
                name: skill.name,
            });
    }

    // Step 4: Build the map of technology names to IDs
    const mapOfTechs: { [name: string]: number } = {};
    existingTechs.forEach(tech => {
        mapOfTechs[tech.name] = tech.id;
    });
    newTechs.forEach(tech => {
        mapOfTechs[tech.name] = tech.id;
    });

    return mapOfTechs;
};
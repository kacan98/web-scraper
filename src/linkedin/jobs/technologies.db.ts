import { db } from 'db';
import { technologyOnJobs } from 'db/schema/linkedin/linkedin-schema';
import { inArray } from 'drizzle-orm';

export const findOrInsertTechnologies = async (technologies: string[]): Promise<{ [name: string]: number }> => {
    // Step 1: Find existing technologies
    const existingTechs = await db
        .select({
            id: technologyOnJobs.id,
            name: technologyOnJobs.name,
        })
        .from(technologyOnJobs)
        .where(inArray(technologyOnJobs.name, technologies));

    // Step 2: Identify new technologies
    const existingNames = existingTechs.map(tech => tech.name);
    const newTechNames = [...new Set(technologies.filter(name => !existingNames.includes(name)))];

    // Step 3: Insert new technologies if any
    let newTechs: { id: number; name: string }[] = [];
    if (newTechNames.length > 0) {
        newTechs = await db
            .insert(technologyOnJobs)
            .values(newTechNames.map(name => ({ name })))
            .returning({
                id: technologyOnJobs.id,
                name: technologyOnJobs.name,
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
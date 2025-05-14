import { db } from 'db';
import { skillTable, skillJobMappingTable } from 'db/schema/linkedin/linkedin-schema';
import { desc, eq, inArray, sql } from 'drizzle-orm';

export type DatabaseType = typeof db;
export type TransactionType = Parameters<Parameters<DatabaseType['transaction']>[0]>[0];

export const findOrInsertSkillsForJob = async (skills: string[], tx: TransactionType): Promise<{ [name: string]: number }> => {
    // Step 1: Find existing skills
    const existingSkills = await tx
        .select({
            id: skillTable.id,
            name: skillTable.name,
        })
        .from(skillTable)
        .where(inArray(skillTable.name, skills));

    // Step 2: Identify new skills
    const existingNames = existingSkills.map(skill => skill.name);
    const newSkillNames = [...new Set(skills.filter(name => !existingNames.includes(name)))];

    // Step 3: Insert new skills if any
    let newSkills: { id: number; name: string }[] = [];
    if (newSkillNames.length > 0) {
        newSkills = await tx
            .insert(skillTable)
            .values(newSkillNames.map(name => ({ name })))
            .returning({
                id: skillTable.id,
                name: skillTable.name,
            });
    }

    // Step 4: Build the map of skill names to IDs
    const mapOfSkills: { [name: string]: number } = {};
    existingSkills.forEach(skill => {
        mapOfSkills[skill.name] = skill.id;
    });
    newSkills.forEach(skill => {
        mapOfSkills[skill.name] = skill.id;
    });

    return mapOfSkills;
};

export const insertJobSkillMappings = async (jobId: number, skillIds: number[], isRequired: boolean, tx: TransactionType) => {
    if (skillIds.length === 0) {
        return;
    }

    return await tx
        .insert(skillJobMappingTable)
        .values(
            skillIds
                .map(skillId => ({
                    jobId,
                    skillId,
                    isRequired,
                })))
        .onConflictDoNothing()
        .execute();
}

export const extractSkillFrequency = async (): Promise<{ name: string, count: number }[]> => {
    const skills = await db
        .select({
            name: skillTable.name,
            count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(skillTable)
        .leftJoin(skillJobMappingTable, eq(skillJobMappingTable.skillId, skillTable.id))
        .groupBy(skillTable.name)
        .orderBy(({count})=> desc(count))

    return skills
}
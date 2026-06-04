import prisma from "../lib/prisma";

/**
 * Calculates the number of working days between two dates, 
 * excluding configured off-days (weekends) and holidays.
 */
export const calculateWorkingDays = async (
    clinicId: string,
    startDate: Date,
    endDate: Date
) => {
    // 1. Get off-days configuration (default to Sunday off if not found)
    const config = await prisma.workingDaysConfig.findUnique({
        where: { clinicId }
    });
    const offDays = config?.offDays || [0]; // 0 is Sunday

    // 2. Get holidays in range
    const holidays = await prisma.holiday.findMany({
        where: {
            clinicId,
            date: {
                gte: startDate,
                lte: endDate
            }
        },
        select: { date: true }
    });
    const holidayDates = holidays.map(h => h.date.toDateString());

    // 3. Iterate and count
    let workingDaysCount = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        const isOffDay = offDays.includes(dayOfWeek);
        const isHoliday = holidayDates.includes(current.toDateString());

        if (!isOffDay && !isHoliday) {
            workingDaysCount++;
        }

        current.setDate(current.getDate() + 1);
    }

    return workingDaysCount;
};

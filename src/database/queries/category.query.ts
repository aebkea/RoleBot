import { Category, ReactRole } from '../entities';
import { ICategory } from '../entities/category.entity';

// Guild categories
export const GET_GUILD_CATEGORIES = async (guildId: string) => {
  return await Category.find({ where: { guildId }, order: { name: 'ASC' } });
};

export const GET_ROLES_BY_CATEGORY_ID = async (categoryId: number) => {
  return await ReactRole.find({
    where: { category: { id: categoryId } },
    order: { name: 'ASC' },
  });
};

export const CREATE_GUILD_CATEGORY = async (
  guildId: string,
  name: string,
  description: string | undefined,
  mutuallyExclusive: boolean | undefined
) => {
  const category = new Category();

  category.guildId = guildId;
  category.name = name;
  category.description = description ?? '';
  category.mutuallyExclusive = mutuallyExclusive ?? false;

  return await category.save();
};

export const EDIT_CATEGORY_BY_ID = (
  id: number,
  category: Partial<ICategory>
) => {
  return Category.update({ id }, category);
};

export const GET_CATEGORY_BY_NAME = async (guildId: string, name: string) => {
  return await Category.findOne({ where: { guildId, name } });
};

export const GET_CATEGORY_BY_ID = (id: number) => {
  return Category.findOne({ where: { id } });
};

export const DELETE_CATEGORY_BY_ID = (id: number) => {
  return Category.delete({ id });
};
